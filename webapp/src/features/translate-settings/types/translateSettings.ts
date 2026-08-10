/** Ручное зеркало серверных типов (bot/src/server/settings/translate.controller.ts). */

export interface TranslateSettings {
  engine: "google" | "ai";
  targetLang: string;
  /** null — свой промпт не задан, сервер использует дефолтный шаблон. */
  promptTemplate: string | null;
  reasoningEffort: string;
}

export interface TranslateSettingsPatch {
  engine?: "google" | "ai";
  targetLang?: string;
  /** undefined — не трогать; null — сбросить на дефолтный промпт; string — задать свой. */
  promptTemplate?: string | null;
  reasoningEffort?: string;
}
