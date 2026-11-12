import { Injectable } from "@nestjs/common";
import { LlmSettingsRepository } from "../settings/llm/llm-settings.repository.js";
import { requestChatCompletion } from "./chat-completions/client.js";
import { DEFAULT_DEEPSEEK_MODEL } from "./constants.js";
import { MissingApiKeyError } from "./errors.js";
import { buildDeepSeekProvider, type LlmProvider } from "./providers.js";
import { requestResponse } from "./responses/client.js";
import type { ResponsesCompleter, ResponsesRequestOptions, ResponsesResult } from "./responses/types.js";
import type { ChatCompleter, ChatCompletionOptions, ChatCompletionResult, OnToolCallDelta } from "./types.js";

/**
 * Вызов LLM от имени пользователя (BYOK — общего ключа из env нет): на КАЖДЫЙ вызов читает его
 * ключ из user_settings и отдаёт запрос чистому клиенту. Ключ не кэшируем — смена/удаление ключа в
 * настройках действует сразу, а MissingApiKeyError вылетает там же, где и раньше (обработчики сжатия,
 * ретрая перевода и SSE-ошибки на это рассчитывают).
 *
 * Два протокола: complete — Chat Completions (chat-completions/client.ts), respond — Responses API (responses/client.ts,
 * сейчас только соавтор: ему нужны картинки в результатах инструментов).
 */
@Injectable()
export class LlmService implements ChatCompleter, ResponsesCompleter {
  constructor(private readonly settings: LlmSettingsRepository) {}

  async complete(
    options: ChatCompletionOptions,
    onChunk?: (token: string) => void,
    onReset?: () => void,
    onToolCall?: OnToolCallDelta,
  ): Promise<ChatCompletionResult> {
    return requestChatCompletion(await this.provider(options.userId), options, onChunk, onReset, onToolCall);
  }

  async respond(
    options: ResponsesRequestOptions,
    onChunk?: (token: string) => void,
    onReset?: () => void,
    onToolCall?: OnToolCallDelta,
  ): Promise<ResponsesResult> {
    return requestResponse(await this.provider(options.userId), options, onChunk, onReset, onToolCall);
  }

  /** Провайдер с ключом пользователя. Модель — из пресета вызова (options.model); без пресета — дефолтная. */
  private async provider(userId: string): Promise<LlmProvider> {
    const apiKey = await this.settings.getDecryptedApiKey(userId);
    if (!apiKey) throw new MissingApiKeyError();
    return buildDeepSeekProvider(apiKey, DEFAULT_DEEPSEEK_MODEL);
  }
}
