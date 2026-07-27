import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { LlmHttpError } from "./errors.js";

/** Ответ DeepSeek GET /models (OpenAI-совместимый формат): { object: "list", data: [{ id, ... }] }. */
interface DeepSeekModelsResponse {
  data: Array<{ id: string }>;
}

/**
 * Список доступных моделей DeepSeek для данного ключа — совмещает «проверить ключ» и «получить
 * модели» в одном запросе (см. bot/src/server/settings/settings.controller.ts). Бросает
 * LlmHttpError на не-2xx — 401 отличает неверный ключ от прочих сбоев. Без ретрая на 401
 * (как в client.ts — ретраятся только 5xx/429, а не сама неверность ключа).
 */
export async function listDeepSeekModels(apiKey: string): Promise<string[]> {
  const t0 = Date.now();
  const data = await retry<DeepSeekModelsResponse>(
    async () => {
      const response = await fetch("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new LlmHttpError("deepseek", response.status, text);
      }
      return (await response.json()) as DeepSeekModelsResponse;
    },
    3,
    1500,
    "deepseek.listModels",
    (err) => (err instanceof LlmHttpError ? err.status >= 500 || err.status === 429 : true),
  );

  const models = data.data.map((m) => m.id);
  logger.info({ durationMs: Date.now() - t0, count: models.length }, "DeepSeek models listed");
  return models;
}
