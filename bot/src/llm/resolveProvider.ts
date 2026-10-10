import { getDecryptedDeepSeekCredentials } from "../db/settings/index.js";
import { DEFAULT_DEEPSEEK_MODEL } from "./constants.js";
import { MissingApiKeyError } from "./errors.js";
import { buildDeepSeekProvider } from "./providers.js";
import type { LlmProvider } from "./providers.types.js";

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
