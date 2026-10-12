import type { PromptTranslateEngine } from "@tg-rp-bot/shared";
import { googleTranslate } from "./googleTranslate.js";
import { yandexTranslate } from "./yandexTranslate.js";

/** Движки без LLM — бесплатные неофициальные API (с сервера бота, без ключа пользователя). */
export type MachineTranslateEngine = Exclude<PromptTranslateEngine, "ai">;

/** Перевод машинным переводчиком по выбору пользователя (ИИ-перевод — отдельно, ему нужен LLM). */
export function machineTranslate(engine: MachineTranslateEngine, text: string, targetLang: string): Promise<string> {
  return engine === "yandex" ? yandexTranslate(text, targetLang) : googleTranslate(text, targetLang);
}
