import { Button, Cell, Input, Section, Spinner } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { confirmAction } from "../../../shared/telegram/confirm";
import type { useLlmSettings } from "../hooks/useLlmSettings";
import { DeepSeekModelPicker } from "./DeepSeekModelPicker";
import "./LlmSettingsSection.css";

const PICKER_T = { duration: 0.2, ease: "easeOut" as const };

type LlmSettingsSectionProps = Omit<ReturnType<typeof useLlmSettings>, "loading">;

/**
 * Секция настроек «ИИ (DeepSeek)»: персональный ключ + модель (BYOK — общего ключа из env нет,
 * без ключа генерация и ИИ-перевод падают с понятной ошибкой). Кнопка в after поля ввода —
 * условная: пока поле не пустое, она проверяет введённый ключ и сразу сохраняет его вместе с
 * резолвленной моделью (verifyAndSave); когда поле пустое, а ключ уже сохранён — превращается
 * в удаление ключа. Отдельной кнопки «Сохранить» нет — выбор модели в DeepSeekModelPicker сохраняет
 * её сразу (save с override, т.к. setSelectedModel ещё не осел в state в момент вызова).
 *
 * Состояние (useLlmSettings) поднято в SettingsPage — загрузка статуса показывается на весь
 * экран настроек, а не спиннером внутри секции, чтобы контент не «прыгал» при смене вкладки.
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
}: LlmSettingsSectionProps) {
  const hasInput = keyInput.trim().length > 0;
  const keyAction: "save" | "delete" | "none" = hasInput ? "save" : status.hasKey ? "delete" : "none";
  // overflow:hidden нужен только пока идёт height-анимация (иначе схлопывание не увидеть); в
  // раскрытом состоянии он обрезает абсолютно спозиционированное меню DropdownPicker внутри —
  // поэтому снимаем его сразу после завершения анимации и возвращаем перед следующей (сворачивание).
  const [pickerAnimating, setPickerAnimating] = useState(false);

  const handleDeleteKey = async () => {
    const confirmed = await confirmAction("Удалить ключ DeepSeek? Генерация перестанет работать.", {
      title: "Удалить ключ?",
    });
    if (confirmed) void clearKey();
  };

  return (
    <Section header="ИИ (DeepSeek)">
      <div className="llm-settings">
        <Cell
          subtitle={status.hasKey ? `Ключ сохранён, оканчивается на …${status.last4}` : "Ключ не задан"}
        >
          Ключ API
        </Cell>
        <Input
          type="password"
          placeholder={status.hasKey ? "Введите новый, чтобы заменить" : "sk-…"}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          autoComplete="off"
          after={
            keyAction === "none" ? null : (
              <Button
                size="s"
                mode={keyAction === "delete" ? "outline" : "bezeled"}
                className={
                  keyAction === "delete" ? "llm-settings__key-action delete-button" : "llm-settings__key-action"
                }
                disabled={verifying || saving}
                onClick={() => {
                  if (keyAction === "save") void verifyAndSave();
                  else void handleDeleteKey();
                }}
                aria-label={keyAction === "delete" ? "Удалить ключ" : "Сохранить ключ"}
              >
                {verifying || saving ? (
                  <Spinner size="s" />
                ) : keyAction === "delete" ? (
                  <Trash2 size={14} />
                ) : (
                  <Check size={14} />
                )}
              </Button>
            )
          }
        />

        {/* initial={false} — без него пикер проигрывал бы анимацию появления при каждом заходе
            на страницу настроек (SettingsPage монтирует секцию уже с готовым status.hasKey),
            а не только в момент реального добавления ключа. */}
        <AnimatePresence initial={false}>
          {status.hasKey && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={PICKER_T}
              style={{ overflow: pickerAnimating ? "hidden" : "visible" }}
              onAnimationStart={() => setPickerAnimating(true)}
              onAnimationComplete={() => setPickerAnimating(false)}
            >
              <DeepSeekModelPicker
                className="llm-settings__picker-gutter"
                header="Модель"
                subtitle={verifying ? "Загрузка моделей…" : models ? "Список получен от DeepSeek" : "Откройте список, чтобы загрузить модели"}
                value={selectedModel}
                options={models ?? (status.model ? [status.model] : [])}
                onChange={(model) => {
                  setSelectedModel(model);
                  void save(model);
                }}
                disabled={saving}
                // Реверифай только сохранённого ключа: если поле не пустое, там ещё не
                // сохранённый черновик замены — его не подсовываем как "текущий" при простом
                // открытии списка моделей (иначе неполный/невалидный черновик всплывёт тостом-ошибкой).
                onOpen={() => {
                  if (!hasInput) void verify({ silent: true });
                }}
                pending={verifying}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Section>
  );
}
