import type { LlmProvider } from "./providers.types.js";

// Типы провайдера живут в providers.types.ts; реэкспорт — чтобы клиентам хватало одного импорта.
export type { LlmProvider, LlmProviderName } from "./providers.types.js";

/**
 * Уровень рассуждения → DeepSeek effort (low|high|max). Уровни пресета уже совпадают с DeepSeek, но
 * строку из БД не шлём как есть: на неизвестных значениях DeepSeek отвечает 422, поэтому всё
 * непредусмотренное (и пустое значение) → high, дефолт API. Общий для обоих протоколов.
 */
export function mapEffort(effort?: string | null): "low" | "high" | "max" {
  return effort === "low" || effort === "max" ? effort : "high";
}

/**
 * Провайдер резолвится per-user (см. llm/llm.service.ts) — ключ/модель приходят из userSettings,
 * а не из env. Фабрика принимает их параметрами вместо чтения из глобального config.
 */
export function buildDeepSeekProvider(apiKey: string, model: string): LlmProvider {
  return {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com",
    apiKey,
    defaultModel: model,
  };
}

/** Заголовки запроса: авторизация провайдера + Content-Type. Общие для обоих протоколов. */
export function makeHeaders(provider: LlmProvider): Record<string, string> {
  return {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
  };
}
