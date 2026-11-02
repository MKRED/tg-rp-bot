import { Group, Slider, Text } from "@mantine/core";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import type { useWebSearchSettings } from "../hooks/useWebSearchSettings";
import { MAX_SEARCH_ROUNDS, MIN_SEARCH_ROUNDS } from "../lib/searchRounds";

type WebSearchSettingsSectionProps = Omit<ReturnType<typeof useWebSearchSettings>, "loading">;

/**
 * Карточка «Веб-поиск»: лимит раундов поиска при генерации карточек. Своего ключа нет — поиск
 * DeepSeek оплачивается с того же ключа, что и генерация, об этом и говорит описание карточки.
 *
 * Состояние (useWebSearchSettings) поднято в SettingsPage — по тому же паттерну, что и useLlmSettings.
 */
export function WebSearchSettingsSection({
  maxSearchRounds,
  setMaxSearchRounds,
  saveMaxSearchRounds,
}: WebSearchSettingsSectionProps) {
  return (
    <SettingsCard
      title="Веб-поиск"
      description="Поиск DeepSeek при генерации карточек — через ваш ключ DeepSeek, около $0.75 за 1000 запросов."
    >
      <div>
        <Group justify="space-between" gap="xs" mb={4}>
          <Text size="sm" fw={500}>
            Лимит раундов веб-поиска
          </Text>
          <Text size="sm" c="dimmed">
            {maxSearchRounds}
          </Text>
        </Group>
        <Slider
          min={MIN_SEARCH_ROUNDS}
          max={MAX_SEARCH_ROUNDS}
          step={1}
          value={maxSearchRounds}
          onChange={setMaxSearchRounds}
          onChangeEnd={saveMaxSearchRounds}
          label={null}
          aria-label="Лимит раундов веб-поиска"
        />
        <Text size="xs" c="dimmed" mt="xs">
          Максимум обращений к веб-поиску подряд за одну генерацию блока карточки. По достижении лимита
          модель отвечает тем, что успела найти.
        </Text>
      </div>
    </SettingsCard>
  );
}
