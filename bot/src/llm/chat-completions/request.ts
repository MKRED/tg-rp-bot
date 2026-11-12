import { mapEffort, type LlmProvider } from "../providers.js";
import type { ChatCompletionOptions } from "../types.js";

/**
 * Поля thinking-режима DeepSeek в Chat Completions. У v4-моделей thinking включён по умолчанию —
 * выключаем явно. (В Responses API это поле игнорируется, там свой `reasoning.effort`.)
 */
export function thinkingBody(opts: ChatCompletionOptions): Record<string, unknown> {
  if (!opts.requestReasoning) {
    return { thinking: { type: "disabled" } };
  }
  return {
    thinking: { type: "enabled" },
    reasoning_effort: mapEffort(opts.reasoningEffort),
  };
}

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
    ...thinkingBody(options),
  };
}
