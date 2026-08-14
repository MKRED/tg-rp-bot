import { Caption } from "@telegram-apps/telegram-ui";
import { tokenBudget } from "../../text/token-budget";
import "./TokenBudgetBar.css";

interface TokenBudgetBarProps {
  /** Использовано токенов (оценка). */
  used: number;
  /** Лимит контекста; null — безграничный. */
  limit: number | null;
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

/**
 * Полоса «использовано / доступно» токенов запроса. При безграничном контексте полосу не рисуем —
 * показываем только «~used / ∞». Цвет полосы меняется в жёлтой/красной зоне (см. tokenBudget).
 * Переиспользуется секцией «Статистика» в настройках RP-чата и истории (narrator).
 */
export function TokenBudgetBar({ used, limit }: TokenBudgetBarProps) {
  const { pct, level, unlimited } = tokenBudget(used, limit);

  return (
    <div className="token-budget">
      <div className="token-budget__caption">
        <Caption level="1">~{fmt(used)}</Caption>
        <Caption level="1">{unlimited ? "∞" : fmt(limit!)}</Caption>
      </div>
      {!unlimited && (
        <div className="token-budget__track">
          <div
            className={`token-budget__fill token-budget__fill--${level}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
