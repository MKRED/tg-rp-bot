import { config } from "../config.js";
import { OPENROUTER_APP_HEADERS } from "./constants.js";
import type { ChatCompletionOptions } from "./types.js";

/** Имя LLM-провайдера. */
export type LlmProviderName = "openrouter" | "deepseek";

/** Описание провайдера: всё, чем отличается один OpenAI-совместимый бэкенд от другого. */
export interface LlmProvider {
  name: LlmProviderName;
  baseUrl: string;
  apiKey: string | undefined;
  defaultModel: string;
  /** Доп. заголовки атрибуции приложения (есть у OpenRouter, нет у DeepSeek). */
  appHeaders?: Record<string, string>;
  /** Провайдеро-специфичные поля reasoning в теле запроса (пустой объект — не добавлять ничего). */
  reasoningBody: (opts: ChatCompletionOptions) => Record<string, unknown>;
}

/**
 * Схлопывает 5-уровневый enum пресета (minimal|low|medium|high|xhigh) в значения,
 * которые принимает DeepSeek reasoning_effort (только high|max). Сырую строку слать нельзя —
 * на minimal/low/medium DeepSeek вернёт 422.
 */
export function mapEffort(effort?: string | null): "high" | "max" {
  return effort === "xhigh" ? "max" : "high";
}

/** Поля thinking-режима DeepSeek. У v4-моделей thinking включён по умолчанию — выключаем явно. */
function deepSeekReasoningBody(opts: ChatCompletionOptions): Record<string, unknown> {
  if (!opts.requestReasoning) {
    return { thinking: { type: "disabled" } };
  }
  return {
    thinking: { type: "enabled" },
    reasoning_effort: mapEffort(opts.reasoningEffort),
  };
}

const PROVIDERS: Record<LlmProviderName, LlmProvider> = {
  openrouter: {
    name: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: config.openRouterApiKey,
    defaultModel: config.openRouterModel,
    appHeaders: OPENROUTER_APP_HEADERS,
    // Тело запросов OpenRouter не трогаем — это запасной путь, работает как раньше.
    reasoningBody: () => ({}),
  },
  deepseek: {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com",
    apiKey: config.deepSeekApiKey,
    defaultModel: config.deepSeekModel,
    reasoningBody: deepSeekReasoningBody,
  },
};

/** Активный провайдер по config.llmProvider; неизвестное значение → openrouter. */
export function getActiveProvider(): LlmProvider {
  return PROVIDERS[config.llmProvider as LlmProviderName] ?? PROVIDERS.openrouter;
}
