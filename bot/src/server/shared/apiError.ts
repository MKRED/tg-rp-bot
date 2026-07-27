import type { Context } from "hono";
import { MissingApiKeyError } from "../../llm/errors.js";
import type { AppVariables } from "../middleware/initData.types.js";

/**
 * Единый ответ на ошибку не-стримингового вызова chatCompletion (ИИ-перевод, ручное сжатие
 * истории). На MissingApiKeyError (нет персонального ключа DeepSeek — BYOK) отдаёт 400 с готовым
 * текстом-подсказкой; иначе — прежний общий 500. Стриминговые генерации (SSE) используют свой
 * аналог — writeGenerationError в streamGeneration.ts.
 */
export function chatCompletionErrorResponse(c: Context<{ Variables: AppVariables }>, err: unknown): Response {
  if (err instanceof MissingApiKeyError) {
    return c.json({ error: "no_api_key", message: err.message }, 400);
  }
  return c.json({ error: "Internal error" }, 500);
}
