/** Ручное зеркало серверных типов (bot/src/server/settings/tavily.controller.ts). */

export interface TavilySettingsStatus {
  hasKey: boolean;
  /** Последние 4 символа ключа (для UI, сам ключ сервер не отдаёт). */
  last4: string | null;
  /** Максимум раундов tool-calling подряд за одну генерацию с веб-поиском. */
  maxSearchRounds: number;
}

export interface TavilyUsage {
  plan: string;
  planUsage: number;
  planLimit: number | null;
}

export interface VerifyTavilyKeyResult {
  ok: boolean;
  usage?: TavilyUsage;
  error?: "invalid_key" | "no_key";
}

export interface TavilySettingsPatch {
  /** undefined — не трогать сохранённый ключ; null — удалить; string — задать новый. */
  apiKey?: string | null;
  /** undefined — не трогать лимит раундов; иначе новое значение (кламп — на сервере). */
  maxSearchRounds?: number;
}
