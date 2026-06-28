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
