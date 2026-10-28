import { AnimatePresence, motion } from "framer-motion";
import { ApiKeyField } from "../../../shared/components/ApiKeyField";
import { InfoRow } from "../../../shared/components/InfoRow";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { confirmAction } from "../../../shared/telegram/confirm";
import { MOTION_TRANSITION } from "../../../shared/theme/motion";
import type { useLlmSettings } from "../hooks/useLlmSettings";
import { formatBalanceDescription, formatBalanceSubtitle } from "../lib/formatBalance";

type LlmSettingsSectionProps = Omit<ReturnType<typeof useLlmSettings>, "loading">;

/**
 * Карточка «ИИ (DeepSeek)»: персональный ключ (BYOK — общего ключа нет, без ключа генерация и ИИ-перевод
 * падают с понятной ошибкой). Ключ проверяется и сохраняется кнопкой в поле (verifyAndSave). Модель тут
 * не выбирается — она в пресете генерации. Баланс появляется, только когда ключ сохранён.
 *
 * Состояние (useLlmSettings) поднято в SettingsPage — экран показывает один лоадер, пока не загрузится всё.
 */
export function LlmSettingsSection({
  status,
  keyInput,
  setKeyInput,
  verifying,
  verifyAndSave,
  saving,
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
    <SettingsCard title="ИИ (DeepSeek)" description="Свой ключ DeepSeek — на нём работают генерация и ИИ-перевод. Модель выбирается в пресете генерации.">
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
          уже с готовым status.hasKey), только когда ключ реально добавили или удалили. */}
      <AnimatePresence initial={false}>
        {status.hasKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={MOTION_TRANSITION}
            style={{ overflow: "hidden" }}
          >
            <InfoRow
              label="Баланс DeepSeek"
              value={formatBalanceSubtitle(balance, balanceLoading)}
              hint={formatBalanceDescription(balance)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </SettingsCard>
  );
}
