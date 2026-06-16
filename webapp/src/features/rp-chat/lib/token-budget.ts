// Чистый расчёт состояния полосы «использовано / доступно» токенов для экрана настроек.
// Лимит берётся из пресета чата; null означает безграничный контекст (или размер не задан).

export type BudgetLevel = "ok" | "warn" | "over";

export interface TokenBudget {
  /** Заполнение полосы в процентах, 0–100 (обрезано сверху). */
  pct: number;
  /** Цветовая зона: ok < 85% ≤ warn < 100% ≤ over. */
  level: BudgetLevel;
  /** Лимит отсутствует — показываем «∞», полосу не рисуем. */
  unlimited: boolean;
}

/** Порог перехода в «жёлтую» зону (доля от лимита). */
const WARN_RATIO = 0.85;

export function tokenBudget(used: number, limit: number | null): TokenBudget {
  // null или неположительный лимит — контекст безграничный/не задан.
  if (limit === null || limit <= 0) {
    return { pct: 0, level: "ok", unlimited: true };
  }
  const ratio = used / limit;
  const pct = Math.min(100, Math.round(ratio * 100));
  const level: BudgetLevel = ratio >= 1 ? "over" : ratio >= WARN_RATIO ? "warn" : "ok";
  return { pct, level, unlimited: false };
}
