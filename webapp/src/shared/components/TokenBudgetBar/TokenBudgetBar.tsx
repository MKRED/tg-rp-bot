import { Group, Progress, Text } from "@mantine/core";
import { tokenBudget, type BudgetLevel } from "../../text/token-budget";
import styles from "./TokenBudgetBar.module.css";

interface TokenBudgetBarProps {
  /** Использовано токенов (оценка). */
  used: number;
  /** Лимит контекста; null — безграничный. */
  limit: number | null;
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

/** Цвет полосы по зоне: обычная — акцент, близко к лимиту — жёлтая, сверх лимита — красная. */
const LEVEL_COLOR: Record<BudgetLevel, string> = {
  ok: "accent",
  warn: "yellow",
  over: "red",
};

/**
 * Полоса «использовано / доступно» токенов запроса. При безграничном контексте полосу не рисуем —
 * показываем только «~used / ∞». Цвет меняется в жёлтой/красной зоне (см. tokenBudget).
 * Используется статистикой в настройках RP-чата и истории (narrator).
 */
export function TokenBudgetBar({ used, limit }: TokenBudgetBarProps) {
  const { pct, level, unlimited } = tokenBudget(used, limit);

  return (
    <div className={styles.root}>
      <Group justify="space-between" gap="xs">
        <Text size="sm" c="dimmed">
          ~{fmt(used)}
        </Text>
        <Text size="sm" c="dimmed">
          {unlimited ? "∞" : fmt(limit!)}
        </Text>
      </Group>
      {!unlimited && <Progress value={pct} color={LEVEL_COLOR[level]} size="sm" mt={6} aria-label="Заполнение контекста" />}
    </div>
  );
}
