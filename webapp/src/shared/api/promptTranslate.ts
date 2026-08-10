import { apiFetch } from "./client";

/**
 * Слой API для режима перевода в PromptEditorOverlay — безэнтитный эндпоинт /translate/text
 * (не путать с useComposeTranslate/translate-api.ts — тот для чата/истории и живёт в своей фиче).
 * Живёт в shared/, т.к. PromptEditorOverlay — shared-компонент и не может зависеть от features/*
 * (тот же прецедент, что TranslateSheet + useComposeTranslate).
 */

export type PromptTranslateEngine = "google" | "ai";

export interface TranslateBlocksParams {
  blocks: string[];
  sourceLang: string;
  targetLang: string;
  mode: PromptTranslateEngine;
}

/** Батч-перевод абзацев, строго 1:1 по порядку с blocks. */
export async function translateBlocksApi(params: TranslateBlocksParams): Promise<string[]> {
  const res = await apiFetch<{ translations: string[] }>("/translate/text", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.translations;
}

export interface DefaultTranslateSettings {
  engine: PromptTranslateEngine;
  targetLang: string;
}

/** Дефолты пользователя для сидирования сессии оверлея (движок + целевой язык) — read-only подмножество
 * полной настройки (см. features/translate-settings для полного GET/PATCH со своим ИИ-промптом). */
export async function getDefaultTranslateSettings(): Promise<DefaultTranslateSettings> {
  const res = await apiFetch<{ engine: PromptTranslateEngine; targetLang: string }>("/settings/translate");
  return { engine: res.engine, targetLang: res.targetLang };
}
