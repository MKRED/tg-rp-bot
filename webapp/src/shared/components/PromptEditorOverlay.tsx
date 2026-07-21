import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pushBackInterceptor } from "../telegram/backInterceptor";
import { confirmAction } from "../telegram/confirm";
import "./PromptEditorOverlay.css";

interface PromptEditorOverlayProps {
  title: string;
  placeholder?: string;
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/**
 * Полноэкранный редактор текста промпта — замена разворачивания на месте (ExpandableTextarea).
 * Закрыть случайно нельзя: крестик/свайп-назад/нативная кнопка «Назад» при отредактированном
 * тексте показывают подтверждение через confirmAction вместо молчаливого закрытия.
 *
 * Портал в body, как ImageCropEditor — вне <AppRoot>, поэтому тема через --tg-theme-* (глобальный
 * слой темы SDK), а не --tgui--* (доступны только внутри AppRoot-контекста).
 */
export function PromptEditorOverlay({ title, placeholder, value, onSave, onCancel }: PromptEditorOverlayProps) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  // Не даём открыть второй confirm поверх уже открытого при повторном нажатии «Назад».
  const confirmingRef = useRef(false);

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
      <div className="prompt-editor-overlay__header">
        <button type="button" className="prompt-editor-overlay__cancel" onClick={handleDiscard}>
          Отмена
        </button>
        <span className="prompt-editor-overlay__title">{title}</span>
        <button
          type="button"
          className="prompt-editor-overlay__save"
          disabled={!dirty}
          onClick={() => onSave(draft)}
        >
          Готово
        </button>
      </div>

      <textarea
        className="prompt-editor-overlay__textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
    </motion.div>,
    document.body,
  );
}
