import { BadRequestException, HttpException, InternalServerErrorException } from "@nestjs/common";
import { MissingApiKeyError } from "../llm/errors.js";

/**
 * HTTP-ответ на ошибку не-стримингового вызова LLM (ИИ-перевод и т.п.). Нет персонального ключа
 * DeepSeek (BYOK) — 400 `{ error: "no_api_key", message }` с готовой подсказкой (webapp показывает
 * message); иначе — 500 Internal error. Логирует вызывающий: у него контекст операции.
 */
export function llmHttpError(err: unknown): HttpException {
  if (err instanceof MissingApiKeyError) return new BadRequestException({ error: "no_api_key", message: err.message });
  return new InternalServerErrorException("Internal error");
}
