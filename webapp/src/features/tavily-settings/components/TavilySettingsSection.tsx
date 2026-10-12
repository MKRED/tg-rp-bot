import { Group, Slider, Stack, Text } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { ApiKeyField } from "../../../shared/components/ApiKeyField";
import { InfoRow } from "../../../shared/components/InfoRow";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { confirmAction } from "../../../shared/telegram/confirm";
import { MOTION_TRANSITION } from "../../../shared/theme/motion";
import type { useTavilySettings } from "../hooks/useTavilySettings";
import { formatUsageDescription, formatUsageSubtitle } from "../lib/formatUsage";
import { MAX_SEARCH_ROUNDS, MIN_SEARCH_ROUNDS } from "../lib/searchRounds";

type TavilySettingsSectionProps = Omit<ReturnType<typeof useTavilySettings>, "loading">;

/**
 * Карточка «Веб-поиск (Tavily)»: персональный ключ (BYOK), квота и лимит раундов поиска. Ключ — тем же
 * ApiKeyField, что у DeepSeek; квота и лимит появляются, только когда ключ сохранён.
 *
 * Состояние (useTavilySettings) поднято в SettingsPage — по тому же паттерну, что и useLlmSettings.
 */
export function TavilySettingsSection({
  status,
  keyInput,
  setKeyInput,
  verifying,
  verifyAndSave,
  saving,
  usage,
  usageLoading,
  clearKey,
  maxSearchRounds,
  setMaxSearchRounds,
  saveMaxSearchRounds,
}: TavilySettingsSectionProps) {
  const handleDeleteKey = async () => {
    const confirmed = await confirmAction("Удалить ключ Tavily? Веб-поиск перестанет работать.", {
      title: "Удалить ключ?",
    });
    if (confirmed) void clearKey();
  };

  return (
    <SettingsCard title="Веб-поиск (Tavily)" description="Свой ключ Tavily — для веб-поиска при генерации карточек.">
      <ApiKeyField
        label="Ключ API"
        description={status.hasKey ? `Ключ сохранён, оканчивается на …${status.last4}` : "Ключ не задан"}
        placeholder={status.hasKey ? "Введите новый, чтобы заменить" : "tvly-…"}
        value={keyInput}
        onChange={setKeyInput}
        hasKey={status.hasKey}
        busy={verifying || saving}
        onSave={() => void verifyAndSave()}
        onDelete={() => void handleDeleteKey()}
      />

      {/* initial={false} — как в LlmSettingsSection: анимация только при реальном добавлении/удалении ключа. */}
      <AnimatePresence initial={false}>
        {status.hasKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={MOTION_TRANSITION}
            style={{ overflow: "hidden" }}
          >
            <Stack gap="md">
              <InfoRow
                label="Квота Tavily"
                value={formatUsageSubtitle(usage, usageLoading)}
                hint={formatUsageDescription(usage)}
              />
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
                  Максимум обращений к веб-поиску подряд за одну генерацию блока карточки. По достижении
                  лимита модель отвечает тем, что успела найти.
                </Text>
              </div>
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </SettingsCard>
  );
}
