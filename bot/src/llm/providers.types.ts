import type { ChatCompletionOptions } from "./types.js";

/** Имя LLM-провайдера. */
export type LlmProviderName = "deepseek";

/** Описание провайдера: всё, чем отличается один OpenAI-совместимый бэкенд от другого. */
export interface LlmProvider {
  name: LlmProviderName;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  /** Провайдеро-специфичные поля reasoning в теле запроса (пустой объект — не добавлять ничего). */
  reasoningBody: (opts: ChatCompletionOptions) => Record<string, unknown>;
}
