/** Ручное зеркало серверных типов (bot/src/server/settings/settings.controller.ts). */

export interface LlmSettingsStatus {
  hasKey: boolean;
  /** Последние 4 символа ключа (для UI, сам ключ сервер не отдаёт). */
  last4: string | null;
  model: string | null;
}

export interface VerifyDeepSeekKeyResult {
  ok: boolean;
  models?: string[];
  error?: "invalid_key" | "no_key";
}

export interface LlmSettingsPatch {
  /** undefined — не трогать сохранённый ключ; null — удалить; string — задать новый. */
  apiKey?: string | null;
  model?: string;
}
