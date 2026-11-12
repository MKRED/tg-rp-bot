/** Ошибки LLM-вызова — вынесены из client.ts, чтобы решение о ретрае читалось отдельно от логики. */

/** Ошибка с HTTP-статусом LLM-провайдера — по статусу решаем, ретраить ли. */
export class LlmHttpError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(`${provider} ${status}: ${bodyText}`);
    this.name = "LlmHttpError";
  }
}

/** Ответ пришёл, но непригоден (пустой текст или отказ модели) — ретраибл. */
export class EmptyCompletionError extends Error {
  constructor() {
    super("LLM returned an empty or refusal completion");
    this.name = "EmptyCompletionError";
  }
}

/**
 * HTTP 200, но тело — не ответ chat completion (не JSON, `null`, нет choices). Так бывает у DeepSeek под
 * нагрузкой: соединение часами держится пустыми keep-alive строками и может закрыться без ответа.
 * Ретраибл, как 5xx. bodySnippet — начало тела для лога (пустые строки обрезаны).
 */
export class MalformedCompletionError extends Error {
  constructor(
    readonly provider: string,
    readonly bodySnippet: string,
  ) {
    super(`${provider} returned a malformed completion body: ${JSON.stringify(bodySnippet)}`);
    this.name = "MalformedCompletionError";
  }
}

/**
 * Responses API: генерация провалилась на стороне провайдера (status "failed", событие стрима
 * `response.failed`/`error`) или стрим закрылся без финального события. Ретраибл, как 5xx.
 */
export class ResponseFailedError extends Error {
  constructor(
    readonly provider: string,
    detail: string,
  ) {
    super(`${provider} response failed: ${detail}`);
    this.name = "ResponseFailedError";
  }
}

/**
 * Ретраить ли ошибку вызова LLM: всё, кроме 4xx от провайдера (кроме 429), — сеть, 5xx, пустой ответ,
 * битое тело, провал генерации. 4xx — ошибка запроса или ключа, повтор её не исправит.
 */
export function isRetryableLlmError(err: unknown): boolean {
  return err instanceof LlmHttpError ? err.status >= 500 || err.status === 429 : true;
}

/**
 * У пользователя не задан персональный ключ LLM-провайдера (BYOK — общего ключа из env больше нет).
 * Штатное состояние, не авария: сообщение готово для показа пользователю как есть.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("У вас не задан ключ API ИИ. Откройте Настройки → ИИ и добавьте ключ.");
    this.name = "MissingApiKeyError";
  }
}
