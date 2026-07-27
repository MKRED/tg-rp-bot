import { OPENROUTER_APP_HEADERS } from "./constants.js";
import type { LlmProvider } from "./providers.types.js";
import type { ChatCompletionOptions } from "./types.js";

// Типы провайдера живут в providers.types.ts; реэкспорт сохраняет прежние точки импорта
// (client.ts, request.ts).
export type { LlmProvider, LlmProviderName } from "./providers.types.js";

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

/**
 * Провайдер сейчас резолвится per-user (см. llm/resolveProvider.ts) — ключ/модель приходят из
 * userSettings, а не из env. Фабрики принимают их параметрами вместо чтения из глобального config.
 */
export function buildDeepSeekProvider(apiKey: string, model: string): LlmProvider {
  return {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com",
    apiKey,
    defaultModel: model,
    reasoningBody: deepSeekReasoningBody,
  };
}

/**
 * Задел на будущий выбор провайдера (пока нигде не вызывается — резолвится только DeepSeek,
 * см. llm/resolveProvider.ts). Оставлена, чтобы не переписывать заново, когда для OpenRouter
 * появится своя пара полей в userSettings и выбор в UI настроек.
 */
export function buildOpenRouterProvider(apiKey: string, model: string): LlmProvider {
  return {
    name: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey,
    defaultModel: model,
    appHeaders: OPENROUTER_APP_HEADERS,
    // Тело запросов OpenRouter не трогаем — это запасной путь, работает как раньше.
    reasoningBody: () => ({}),
  };
}
