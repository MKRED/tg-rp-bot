import { Box, Button, Group, Text } from "@mantine/core";
import { Eraser } from "lucide-react";
import { InfoRow } from "../../../../shared/components/InfoRow";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { TokenBudgetBar } from "../../../../shared/components/TokenBudgetBar";
import type { ChatStats } from "../../types/chat";

interface ChatStatsCardProps {
  stats: ChatStats;
  clearing: boolean;
  onClearVariants: () => void;
}

// Токены — оценка (~), с разделителями разрядов.
const fmtTokens = (n: number) => `~${n.toLocaleString("ru-RU")}`;

/** Статистика чата: токены всех веток и текущей, заполнение контекста запроса, сохранённые варианты реплик. */
export function ChatStatsCard({ stats, clearing, onClearVariants }: ChatStatsCardProps) {
  return (
    <SettingsCard title="Статистика">
      <InfoRow label="Весь чат" value={fmtTokens(stats.tokensTotal)} hint="Токенов в сообщениях всех веток" />
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
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Box flex={1} miw={0}>
          <Text size="sm" fw={500}>
            Варианты реплик: {stats.impersonationCount}
          </Text>
          <Text size="xs" c="dimmed">
            Сохранённые «ответы от вашего лица»
          </Text>
        </Box>
        <Button
          variant="light"
          size="compact-md"
          flex="none"
          leftSection={<Eraser size={16} />}
          disabled={stats.impersonationCount === 0}
          loading={clearing}
          onClick={onClearVariants}
        >
          Очистить
        </Button>
      </Group>
    </SettingsCard>
  );
}
