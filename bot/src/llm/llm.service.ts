import { Injectable } from "@nestjs/common";
import { LlmSettingsRepository } from "../settings/llm/llm-settings.repository.js";
import { requestChatCompletion } from "./client.js";
import { DEFAULT_DEEPSEEK_MODEL } from "./constants.js";
import { MissingApiKeyError } from "./errors.js";
import { buildDeepSeekProvider, type LlmProvider } from "./providers.js";
import type { ChatCompleter, ChatCompletionOptions, ChatCompletionResult } from "./types.js";

/**
 * Вызов LLM от имени пользователя (BYOK — общего ключа из env нет): на КАЖДЫЙ вызов читает его
 * ключ/модель из user_settings и отдаёт запрос чистому клиенту (client.ts). Ключ не кэшируем —
 * смена/удаление ключа в настройках действует сразу, а MissingApiKeyError вылетает там же, где и
 * раньше (обработчики сжатия, ретрая перевода и SSE-ошибки на это рассчитывают).
 */
@Injectable()
export class LlmService implements ChatCompleter {
  constructor(private readonly settings: LlmSettingsRepository) {}

  async complete(
    options: ChatCompletionOptions,
    onChunk?: (token: string) => void,
    onReset?: () => void,
  ): Promise<ChatCompletionResult> {
    const provider = await this.resolveProvider(options.userId);
    return requestChatCompletion(provider, options, onChunk, onReset);
  }

  /**
   * Сейчас всегда DeepSeek: выбор провайдера появится вместе с UI выбора (см. providers.ts —
   * buildOpenRouterProvider уже готов, но пока нигде не вызывается).
   */
  private async resolveProvider(userId: number): Promise<LlmProvider> {
    const creds = await this.settings.getDecryptedCredentials(userId);
    if (!creds) throw new MissingApiKeyError();
    return buildDeepSeekProvider(creds.apiKey, creds.model ?? DEFAULT_DEEPSEEK_MODEL);
  }
}
