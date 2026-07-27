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
 * У пользователя не задан персональный ключ LLM-провайдера (BYOK — общего ключа из env больше нет).
 * Штатное состояние, не авария: сообщение готово для показа пользователю как есть. Текст намеренно
 * не называет конкретного провайдера (сейчас это всегда DeepSeek, но фраза не должна протухнуть,
 * когда появится выбор провайдера — см. buildOpenRouterProvider в providers.ts).
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("У вас не задан ключ API ИИ. Откройте Настройки → ИИ и добавьте ключ.");
    this.name = "MissingApiKeyError";
  }
}
