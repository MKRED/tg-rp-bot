import type { LlmProvider } from "./providers.js";
import type { ChatCompletionOptions } from "./types.js";

/** Собирает RAW-тело запроса к провайдеру: передаём только заданные параметры (undefined → дефолт). */
export function buildBody(
  options: ChatCompletionOptions,
  stream: boolean,
  provider: LlmProvider,
): Record<string, unknown> {
  return {
    model: options.model ?? provider.defaultModel,
    messages: options.messages,
    stream,
    // Передаём только заданные параметры — провайдер применяет дефолты на undefined.
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    ...(options.topP !== undefined && { top_p: options.topP }),
    ...(options.topK !== undefined && { top_k: options.topK }),
    ...(options.frequencyPenalty !== undefined && { frequency_penalty: options.frequencyPenalty }),
    ...(options.presencePenalty !== undefined && { presence_penalty: options.presencePenalty }),
    ...(options.repetitionPenalty !== undefined && { repetition_penalty: options.repetitionPenalty }),
    ...(options.minP !== undefined && { min_p: options.minP }),
    ...(options.topA !== undefined && { top_a: options.topA }),
    ...(options.tools !== undefined && { tools: options.tools }),
    ...(options.toolChoice !== undefined && { tool_choice: options.toolChoice }),
    // Reasoning подключается провайдеро-специфично (для DeepSeek — thinking-режим).
    ...provider.reasoningBody(options),
  };
}

/** Заголовки запроса: авторизация провайдера + Content-Type + app-заголовки провайдера. */
export function makeHeaders(provider: LlmProvider): Record<string, string> {
  return {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
    ...provider.appHeaders,
  };
}
