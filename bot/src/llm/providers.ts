import { OPENROUTER_APP_HEADERS } from "./constants.js";
import type { LlmProvider } from "./providers.types.js";
import type { ChatCompletionOptions } from "./types.js";

// Типы провайдера живут в providers.types.ts; реэкспорт сохраняет прежние точки импорта
// (client.ts, request.ts).
export type { LlmProvider, LlmProviderName } from "./providers.types.js";

/**
 * Схлопывает провайдеро-независимый enum пресета (minimal|low|medium|high|xhigh|max|ultra) в
 * значения DeepSeek reasoning_effort (low|high|max). Таблица повторяет официальный
 * compat-маппинг DeepSeek (guides/thinking_mode): xhigh там → high, а max — только max/ultra.
 * Маппим сами, а не шлём сырую строку: так тело запроса не зависит от того, примет ли API
 * алиас (раньше на неизвестных уровнях DeepSeek отвечал 422). Пустое значение → high (дефолт API).
 */
export function mapEffort(effort?: string | null): "low" | "high" | "max" {
  switch (effort) {
    case "minimal":
    case "low":
      return "low";
    case "max":
    case "ultra":
      return "max";
    default:
      return "high";
  }
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
 * Провайдер сейчас резолвится per-user (см. llm/llm.service.ts) — ключ/модель приходят из
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
 * см. llm/llm.service.ts). Оставлена, чтобы не переписывать заново, когда для OpenRouter
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
