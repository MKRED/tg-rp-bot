import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import logger from "../logger.js";

/**
 * Приводит ошибки Nest к контракту, который ждёт webapp (`apiFetch` берёт текст из `message ?? error`):
 * - встроенные исключения (`{ statusCode, message, error }`) → `{ error: "<сообщение>" }`; массив
 *   сообщений ValidationPipe склеивается — иначе webapp показал бы общий «API … failed»;
 * - исключение с собственным телом без statusCode (напр. `{ error: "no_api_key", message }`) —
 *   отдаётся как есть;
 * - всё остальное — 500 `{ error: "Internal error" }` + logger.error с контекстом запроса.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(toErrorBody(exception.getResponse()));
      return;
    }

    // userId есть, если guard уже отработал — чтобы 500 в проде можно было отнести к пользователю.
    const userId = (request as Partial<AuthenticatedRequest>).userId;
    logger.error({ err: exception, userId, method: request.method, path: request.path }, "Unhandled API error");
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal error" });
  }
}

/** Тело ответа для HttpException (вынесено для тестов). */
export function toErrorBody(payload: string | object): object {
  if (typeof payload === "string") return { error: payload };
  const body = payload as Record<string, unknown>;
  if (!("statusCode" in body)) return body;
  const message = body.message;
  // Несколько правил одного поля дают одинаковый текст — повторы убираем.
  if (Array.isArray(message)) return { error: [...new Set(message)].join("; ") };
  return { error: typeof message === "string" ? message : String(body.error ?? "Error") };
}
