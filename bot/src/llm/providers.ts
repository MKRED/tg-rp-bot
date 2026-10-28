import type { LlmProvider } from "./providers.types.js";
import type { ChatCompletionOptions } from "./types.js";

// Типы провайдера живут в providers.types.ts; реэкспорт сохраняет прежние точки импорта
// (client.ts, request.ts).
export type { LlmProvider, LlmProviderName } from "./providers.types.js";

/**
 * Уровень рассуждения → DeepSeek reasoning_effort (low|high|max). Уровни пресета уже совпадают с
 * DeepSeek, но строку из БД не шлём как есть: на неизвестных значениях DeepSeek отвечает 422, поэтому
 * всё непредусмотренное (и пустое значение) → high, дефолт API.
 */
export function mapEffort(effort?: string | null): "low" | "high" | "max" {
  return effort === "low" || effort === "max" ? effort : "high";
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
