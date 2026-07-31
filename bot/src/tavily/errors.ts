/** Ошибка с HTTP-статусом Tavily — по статусу решаем, ретраить ли (см. tavilyUsage.ts). */
export class TavilyHttpError extends Error {
  constructor(
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(`tavily ${status}: ${bodyText}`);
    this.name = "TavilyHttpError";
  }
}
