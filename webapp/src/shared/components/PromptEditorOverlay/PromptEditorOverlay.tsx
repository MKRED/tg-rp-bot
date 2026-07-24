import { AppRoot, Button } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPlatform } from "../../telegram/platform";
import { pushBackInterceptor } from "../../telegram/backInterceptor";
import { confirmAction } from "../../telegram/confirm";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useTheme } from "../../theme";
import "./PromptEditorOverlay.css";

// Платформа сессии не меняется — маппим в стиль telegram-ui один раз, как в App.tsx.
const rawPlatform = getPlatform();
const platform: "ios" | "base" = rawPlatform === "ios" || rawPlatform === "macos" ? "ios" : "base";

interface PromptEditorOverlayProps {
  title: string;
  placeholder?: string;
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/**
 * Полноэкранный редактор текста промпта — замена разворачивания на месте (ExpandableTextarea).
 * Закрыть случайно нельзя: кнопка «Отмена»/свайп-назад/нативная кнопка «Назад» при отредактированном
 * тексте показывают подтверждение через confirmAction вместо молчаливого закрытия.
 *
 * Портал в body, как ImageCropEditor — вне <AppRoot> приложения, поэтому --tgui--* переменные темы
 * сюда не доезжают (скоупятся на класс AppRoot, а не :root). Заворачиваем содержимое во ВЛОЖЕННЫЙ
 * AppRoot с теми же appearance/platform, что у корневого (App.tsx) — это просто themed-div без
 * побочных эффектов (SDK не переинициализируется), зато tgui Button в шапке темизируется нормально,
 * а не выглядит инородной голой разметкой. appearance — из useTheme() (общий с корневым AppRoot),
 * а не напрямую из miniApp.isDark: иначе ручной оверрайд темы пользователя не долетел бы сюда,
 * и оверлей «телепортировался» бы в другую тему, чем основное приложение. Сам textarea — обычный
 * HTML-элемент (не tgui Textarea): тот визуально не подходит для полноэкранного редактора,
 * стилизуем вручную под --tgui--* цвета.
 */
export function PromptEditorOverlay({ title, placeholder, value, onSave, onCancel }: PromptEditorOverlayProps) {
  const { appearance } = useTheme();
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  // Не даём открыть второй confirm поверх уже открытого при повторном нажатии «Назад».
  const confirmingRef = useRef(false);

  useBodyScrollLock();

  const handleDiscard = useCallback(() => {
    if (!dirty) {
      onCancel();
      return;
    }
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    confirmAction("Изменения не будут сохранены.", {
      title: "Закрыть без сохранения?",
      confirmText: "Закрыть",
    })
      .then((ok) => {
        if (ok) onCancel();
      })
      .catch((err) => console.error("Не удалось показать подтверждение закрытия редактора промпта", err))
      .finally(() => {
        confirmingRef.current = false;
      });
  }, [dirty, onCancel]);

  // Нативная «Назад» закрывает редактор (с подтверждением при правках), а не уводит со страницы.
  useEffect(() => pushBackInterceptor(handleDiscard), [handleDiscard]);

  return createPortal(
    <motion.div
      className="prompt-editor-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <AppRoot appearance={appearance} platform={platform} className="prompt-editor-overlay__root">
        <div className="prompt-editor-overlay__header">
          <Button mode="plain" size="s" onClick={handleDiscard}>
            Отмена
          </Button>
          <span className="prompt-editor-overlay__title">{title}</span>
          <Button mode="filled" size="s" disabled={!dirty} onClick={() => onSave(draft)}>
            Готово
          </Button>
        </div>

        <div className="prompt-editor-overlay__textarea-wrap">
          <textarea
            className="prompt-editor-overlay__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>
      </AppRoot>
    </motion.div>,
    document.body,
  );
}
