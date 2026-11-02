/** Ошибка с HTTP-статусом поиска DeepSeek — по статусу решаем, ретраить ли (см. WebSearchService.search). */
export class WebSearchHttpError extends Error {
  constructor(
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(`deepseek search ${status}: ${bodyText}`);
    this.name = "WebSearchHttpError";
  }

  /**
   * Ключ невалиден/отозван (401) или на аккаунте DeepSeek кончился баланс (402) — повторять поиск в
   * следующих раундах той же генерации бессмысленно.
   */
  get isAccountProblem(): boolean {
    return this.status === 401 || this.status === 402;
  }
}
