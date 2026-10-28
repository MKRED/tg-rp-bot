import { Injectable } from "@nestjs/common";
import { LlmSettingsRepository } from "../settings/llm/llm-settings.repository.js";
import { requestChatCompletion } from "./client.js";
import { DEFAULT_DEEPSEEK_MODEL } from "./constants.js";
import { MissingApiKeyError } from "./errors.js";
import { buildDeepSeekProvider } from "./providers.js";
import type { ChatCompleter, ChatCompletionOptions, ChatCompletionResult } from "./types.js";

/**
 * Вызов LLM от имени пользователя (BYOK — общего ключа из env нет): на КАЖДЫЙ вызов читает его
 * ключ из user_settings и отдаёт запрос чистому клиенту (client.ts). Ключ не кэшируем —
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
    const apiKey = await this.settings.getDecryptedApiKey(options.userId);
    if (!apiKey) throw new MissingApiKeyError();
    // Модель — из пресета вызова (options.model); у вызовов без пресета (перевод текста) — дефолтная.
    const provider = buildDeepSeekProvider(apiKey, DEFAULT_DEEPSEEK_MODEL);
    return requestChatCompletion(provider, options, onChunk, onReset);
  }
}
