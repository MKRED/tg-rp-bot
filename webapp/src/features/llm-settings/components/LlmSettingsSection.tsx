import { Stack } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { ApiKeyField } from "../../../shared/components/ApiKeyField";
import { InfoRow } from "../../../shared/components/InfoRow";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { confirmAction } from "../../../shared/telegram/confirm";
import { MOTION_TRANSITION } from "../../../shared/theme/motion";
import type { useLlmSettings } from "../hooks/useLlmSettings";
import { formatBalanceDescription, formatBalanceSubtitle } from "../lib/formatBalance";
import { DeepSeekModelPicker } from "./DeepSeekModelPicker";

type LlmSettingsSectionProps = Omit<ReturnType<typeof useLlmSettings>, "loading">;

/**
 * Карточка «ИИ (DeepSeek)»: персональный ключ + модель (BYOK — общего ключа нет, без ключа генерация
 * и ИИ-перевод падают с понятной ошибкой). Ключ проверяется и сохраняется кнопкой в поле (verifyAndSave),
 * модель сохраняется сразу при выборе (save с override — setSelectedModel ещё не осел в state).
 * Модель и баланс появляются, только когда ключ сохранён.
 *
 * Состояние (useLlmSettings) поднято в SettingsPage — экран показывает один лоадер, пока не загрузится всё.
 */
export function LlmSettingsSection({
  status,
  keyInput,
  setKeyInput,
  models,
  selectedModel,
  setSelectedModel,
  verifying,
  verify,
  verifyAndSave,
  saving,
  save,
  clearKey,
  balance,
  balanceLoading,
}: LlmSettingsSectionProps) {
  const handleDeleteKey = async () => {
    const confirmed = await confirmAction("Удалить ключ DeepSeek? Генерация перестанет работать.", {
      title: "Удалить ключ?",
    });
    if (confirmed) void clearKey();
  };

  return (
    <SettingsCard title="ИИ (DeepSeek)" description="Свой ключ DeepSeek — на нём работают генерация и ИИ-перевод.">
      <ApiKeyField
        label="Ключ API"
        description={status.hasKey ? `Ключ сохранён, оканчивается на …${status.last4}` : "Ключ не задан"}
        placeholder={status.hasKey ? "Введите новый, чтобы заменить" : "sk-…"}
        value={keyInput}
        onChange={setKeyInput}
        hasKey={status.hasKey}
        busy={verifying || saving}
        onSave={() => void verifyAndSave()}
        onDelete={() => void handleDeleteKey()}
      />

      {/* initial={false} — блок не проигрывает появление при каждом заходе на экран (секция монтируется
          уже с готовым status.hasKey), только когда ключ реально добавили или удалили. Список Select —
          в портале, поэтому overflow:hidden на время анимации высоты его не обрезает. */}
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
              <DeepSeekModelPicker
                value={selectedModel}
                options={models ?? (status.model ? [status.model] : [])}
                onChange={(model) => {
                  setSelectedModel(model);
                  void save(model);
                }}
                disabled={saving}
                // Перепроверяем только сохранённый ключ: непустое поле — несохранённый черновик замены,
                // его не подсовываем как «текущий» при простом открытии списка (иначе тост-ошибка).
                onOpen={() => {
                  if (!keyInput.trim()) void verify({ silent: true });
                }}
                pending={verifying}
              />
              <InfoRow
                label="Баланс DeepSeek"
                value={formatBalanceSubtitle(balance, balanceLoading)}
                hint={formatBalanceDescription(balance)}
              />
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </SettingsCard>
  );
}
