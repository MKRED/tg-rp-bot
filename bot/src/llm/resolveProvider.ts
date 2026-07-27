import { getDecryptedDeepSeekCredentials } from "../db/userLlmSettings.js";
import { MissingApiKeyError } from "./errors.js";
import { buildDeepSeekProvider } from "./providers.js";
import type { LlmProvider } from "./providers.types.js";

/** Модель по умолчанию, если ключ уже задан, а модель пользователь ещё не выбрал в настройках. */
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

/**
 * Резолвит провайдера для конкретного пользователя (BYOK — общего ключа из env больше нет).
 * Сейчас всегда DeepSeek: выбор провайдера появится вместе с UI выбора (см. providers.ts —
 * buildOpenRouterProvider уже готов, но пока нигде не вызывается).
 */
export async function resolveProvider(userId: number): Promise<LlmProvider> {
  const creds = await getDecryptedDeepSeekCredentials(userId);
  if (!creds) throw new MissingApiKeyError();
  return buildDeepSeekProvider(creds.apiKey, creds.model ?? DEFAULT_DEEPSEEK_MODEL);
}
