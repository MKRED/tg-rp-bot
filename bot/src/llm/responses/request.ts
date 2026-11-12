import { mapEffort, type LlmProvider } from "../providers.js";
import type { ChatCompletionOptions } from "../types.js";
import type { ResponsesRequestOptions, ResponsesTool } from "./types.js";

/**
 * Описание инструмента в формате Responses: поля функции лежат плоско, без обёртки `function`;
 * custom-инструмент уходит как есть.
 */
export function toResponsesTool(tool: ResponsesTool): Record<string, unknown> {
  return tool.type === "custom" ? { ...tool } : { type: "function", ...tool.function };
}

/** Имя инструмента независимо от вида — для списков «что предложено». */
export function responsesToolName(tool: ResponsesTool): string {
  return tool.type === "custom" ? tool.name : tool.function.name;
}

/** tool_choice в формате Responses: принудительный вызов — `{ type, name }`, тоже без обёртки. */
export function toResponsesToolChoice(choice: NonNullable<ChatCompletionOptions["toolChoice"]>): unknown {
  return typeof choice === "string" ? choice : { type: "function", name: choice.function.name };
}

/**
 * RAW-тело запроса Responses API. Отличия от Chat Completions:
 * - `max_output_tokens` вместо `max_tokens` — и в него входит reasoning, не только текст;
 * - мышление выключается только `reasoning.effort: "none"`: `thinking: { type: "disabled" }` Responses
 *   молча игнорирует (проверено — модель всё равно рассуждала). Принудительный tool_choice в режиме
 *   мышления DeepSeek отклоняет (400), как и в Chat Completions.
 */
export function buildResponsesBody(
  options: ResponsesRequestOptions,
  stream: boolean,
  provider: LlmProvider,
): Record<string, unknown> {
  return {
    model: options.model ?? provider.defaultModel,
    // Копия: вызывающий собирает input заново на каждый раунд, но запись отладки не должна делить с ним массив.
    input: [...options.input],
    stream,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { max_output_tokens: options.maxTokens }),
    ...(options.topP !== undefined && { top_p: options.topP }),
    ...(options.tools !== undefined && { tools: options.tools.map(toResponsesTool) }),
    ...(options.toolChoice !== undefined && { tool_choice: toResponsesToolChoice(options.toolChoice) }),
    reasoning: { effort: options.requestReasoning ? mapEffort(options.reasoningEffort) : "none" },
  };
}
