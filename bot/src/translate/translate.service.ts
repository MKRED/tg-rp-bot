import { Injectable } from "@nestjs/common";
import type { TranslateTextRequest } from "@tg-rp-bot/shared";
import { llmHttpError } from "../common/llm-http-error.js";
import { MissingApiKeyError } from "../llm/errors.js";
import logger from "../logger.js";
import { TranslateSettingsRepository } from "../settings/translate/translate-settings.repository.js";
import { retry, runWithConcurrency } from "../utils/index.js";
import {
  aiTranslate,
  DEFAULT_TRANSLATION_TEMPLATE,
  englishLangName,
  googleTranslate,
  MAX_CHARS_PER_CALL,
  resolveTranslationReasoning,
  TRANSLATE_BLOCK_CONCURRENCY,
  translateChunked,
} from "./engine/index.js";

/**
 * Безэнтитный батч-перевод абзацев для режима перевода в PromptEditorOverlay (полноэкранный редактор
 * промпт-полей). В отличие от перевода в чатах/историях, тут нет владения сущностью — только
 * пользователь, чьи ключ DeepSeek и настройки перевода используются.
 */
@Injectable()
export class TranslateService {
  constructor(private readonly translateSettings: TranslateSettingsRepository) {}

  async translateBlocks(userId: number, req: TranslateTextRequest): Promise<string[]> {
    const t0 = Date.now();
    const { blocks, sourceLang, targetLang, mode } = req;
    logger.debug({ userId, mode, blockCount: blocks.length, sourceLang, targetLang }, "Batch block translation start");

    try {
      const translateChunk = await this.chunkTranslator(userId, req);
      const translations = await runWithConcurrency(blocks, TRANSLATE_BLOCK_CONCURRENCY, (text) =>
        translateChunked(text, MAX_CHARS_PER_CALL, translateChunk),
      );
      logger.info({ durationMs: Date.now() - t0, userId, mode, blockCount: blocks.length }, "Batch block translation done");
      return translations;
    } catch (err) {
      // Нет персонального ключа DeepSeek (BYOK) — 400 с готовой подсказкой, как у остальных генераций.
      if (err instanceof MissingApiKeyError) logger.warn({ userId, mode }, "Batch block translation: не задан ключ DeepSeek");
      else logger.error({ err, userId, mode, blockCount: blocks.length }, "Batch block translation failed");
      throw llmHttpError(err);
    }
  }

  /**
   * Переводчик одного чанка. ИИ-режиму нужны промпт-шаблон и reasoning effort пользователя —
   * читаем их один раз на весь батч, а не на каждый блок.
   */
  private async chunkTranslator(
    userId: number,
    { targetLang, mode }: TranslateTextRequest,
  ): Promise<(text: string) => Promise<string>> {
    if (mode === "google") return (text) => googleTranslate(text, targetLang);

    const settings = await this.translateSettings.get(userId);
    const template = settings.promptTemplate?.trim() || DEFAULT_TRANSLATION_TEMPLATE;
    const { requestReasoning, reasoningEffort } = resolveTranslationReasoning(settings.reasoningEffort);
    const targetLangName = englishLangName(targetLang);
    return (text) =>
      retry(
        () => aiTranslate(template, text, targetLangName, userId, requestReasoning, reasoningEffort),
        3,
        1500,
        "aiTranslate chunk",
        (err) => !(err instanceof MissingApiKeyError),
      );
  }
}
