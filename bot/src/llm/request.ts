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
    // Копия массива, не ссылка: вызывающие (tool-loop.ts генерации карточек) переиспользуют один и тот же
    // messages-массив между раундами и продолжают push'ить в него — без копии все прошлые
    // debug-записи (см. debugCapture.ts) ретроактивно показали бы финальную историю целиком,
    // так как хранили бы ссылку на один и тот же мутируемый массив.
    messages: [...options.messages],
    stream,
    // Передаём только заданные параметры — провайдер применяет дефолты на undefined.
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    ...(options.topP !== undefined && { top_p: options.topP }),
    ...(options.tools !== undefined && { tools: options.tools }),
    ...(options.toolChoice !== undefined && { tool_choice: options.toolChoice }),
    // Reasoning подключается провайдеро-специфично (для DeepSeek — thinking-режим).
    ...provider.reasoningBody(options),
  };
}

/** Заголовки запроса: авторизация провайдера + Content-Type. */
export function makeHeaders(provider: LlmProvider): Record<string, string> {
  return {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
  };
}
