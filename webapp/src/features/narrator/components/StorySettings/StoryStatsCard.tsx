import { Text } from "@mantine/core";
import { InfoRow } from "../../../../shared/components/InfoRow";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { TokenBudgetBar } from "../../../../shared/components/TokenBudgetBar";
import type { StoryStats } from "../../types/story";

// Токены — оценка (~), с разделителями разрядов.
const fmtTokens = (n: number) => `~${n.toLocaleString("ru-RU")}`;

/** Статистика истории: токены всех веток и текущей, заполнение контекста запроса. */
export function StoryStatsCard({ stats }: { stats: StoryStats }) {
  return (
    <SettingsCard title="Статистика">
      <InfoRow label="Вся история" value={fmtTokens(stats.tokensTotal)} hint="Токенов в сообщениях всех веток" />
      <InfoRow label="Текущая ветка" value={fmtTokens(stats.tokensActiveBranch)} hint="Токенов в сообщениях ветки" />
      <div>
        <Text size="sm" fw={500}>
          Запрос с промптами
        </Text>
        <Text size="xs" c="dimmed" mb={6}>
          Полный запрос к ИИ: текущая ветка и промпты — из лимита контекста пресета
        </Text>
        <TokenBudgetBar used={stats.tokensPrompt} limit={stats.contextLimit} />
      </div>
    </SettingsCard>
  );
}
