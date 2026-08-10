import type { Context } from "hono";
import { Hono } from "hono";
import { getUserTranslateSettings } from "../../db/userTranslateSettings.js";
import { MissingApiKeyError } from "../../llm/errors.js";
import logger from "../../logger.js";
import { retry } from "../../utils/index.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { chatCompletionErrorResponse } from "../shared/apiError.js";
import {
  DEFAULT_TRANSLATION_TEMPLATE,
  MAX_BLOCKS_PER_REQUEST,
  MAX_CHARS_PER_CALL,
  TRANSLATE_BLOCK_CONCURRENCY,
} from "../shared/translate.constants.js";
import { chunkText, joinChunks } from "../shared/translateChunking.js";
import { aiTranslate, englishLangName, googleTranslate, resolveTranslationReasoning } from "../shared/translate.js";

type Ctx = Context<{ Variables: AppVariables }>;
type TranslateMode = "google" | "ai";

/** Пул с ограниченной конкурентностью — не бомбим неофициальный Google-эндпоинт/личный ключ DeepSeek. */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function runOne(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runOne()));
  return results;
}

/**
 * POST /translate/text — безэнтитный батч-перевод абзацев для режима перевода в PromptEditorOverlay
 * (полноэкранный редактор промпт-полей — персонажи/персоны/карточки/пресеты/шаблоны). В отличие от
 * /chats/:id/translate-text и /stories/:id/translate-text, тут нет владения сущностью — только
 * проверенный tgUser (см. server/me/ — тот же паттерн безэнтитного домена).
 */
export function createTranslateRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  api.post("/text", handleTranslateBlocks);

  return api;
}

async function handleTranslateBlocks(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const t0 = Date.now();

  const body = (await c.req.json().catch(() => ({}))) as {
    blocks?: unknown;
    sourceLang?: unknown;
    targetLang?: unknown;
    mode?: unknown;
  };

  const blocks = Array.isArray(body.blocks) ? body.blocks.filter((b): b is string => typeof b === "string") : [];
  const sourceLang = typeof body.sourceLang === "string" ? body.sourceLang.trim() : "";
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  const mode: TranslateMode = body.mode === "ai" ? "ai" : "google";

  if (blocks.length === 0 || blocks.length > MAX_BLOCKS_PER_REQUEST || !sourceLang || !targetLang) {
    return c.json(
      { error: `blocks (1..${MAX_BLOCKS_PER_REQUEST}), sourceLang and targetLang are required` },
      400,
    );
  }

  logger.debug(
    { userId, mode, blockCount: blocks.length, sourceLang, targetLang },
    "Batch block translation start",
  );

  // ИИ-режиму нужны пользовательский промпт-шаблон + reasoning effort — читаем один раз на весь батч,
  // а не на каждый блок (см. getUserTranslateSettings).
  let template = DEFAULT_TRANSLATION_TEMPLATE;
  let reasoning: { requestReasoning: boolean; reasoningEffort?: string } = { requestReasoning: false };
  let targetLangName = targetLang;
  if (mode === "ai") {
    const settings = await getUserTranslateSettings(userId);
    template = settings.promptTemplate?.trim() || DEFAULT_TRANSLATION_TEMPLATE;
    reasoning = resolveTranslationReasoning(settings.reasoningEffort);
    targetLangName = englishLangName(targetLang);
  }

  const translateChunk = async (text: string): Promise<string> => {
    if (mode === "google") return googleTranslate(text, targetLang);
    return retry(
      () => aiTranslate(template, text, targetLangName, userId, reasoning.requestReasoning, reasoning.reasoningEffort),
      3,
      1500,
      "aiTranslate chunk",
      (err) => !(err instanceof MissingApiKeyError),
    );
  };

  const translateBlock = async (text: string): Promise<string> => {
    // Пустые/whitespace-блоки — без сетевого вызова (клиент их уже отфильтровал, страхуемся здесь же).
    if (text.trim() === "") return text;
    if (text.length <= MAX_CHARS_PER_CALL) return translateChunk(text);
    const chunks = chunkText(text, MAX_CHARS_PER_CALL);
    const translatedChunks: string[] = [];
    for (const chunk of chunks) translatedChunks.push(await translateChunk(chunk));
    return joinChunks(translatedChunks);
  };

  try {
    const translations = await runWithConcurrency(blocks, TRANSLATE_BLOCK_CONCURRENCY, translateBlock);
    logger.info(
      { durationMs: Date.now() - t0, userId, mode, blockCount: blocks.length },
      "Batch block translation done",
    );
    return c.json({ translations });
  } catch (err) {
    logger.error({ err, userId, mode, blockCount: blocks.length }, "Batch block translation failed");
    return chatCompletionErrorResponse(c, err);
  }
}
