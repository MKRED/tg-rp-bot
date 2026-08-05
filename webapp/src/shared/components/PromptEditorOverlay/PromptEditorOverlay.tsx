import { AppRoot } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPlatform } from "../../telegram/platform";
import { pushBackInterceptor } from "../../telegram/backInterceptor";
import { confirmAction } from "../../telegram/confirm";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useTheme } from "../../theme";
import { PromptEditorHeader } from "./PromptEditorHeader";
import { PromptEditorToolbar } from "./PromptEditorToolbar";
import { useTextHistory } from "./useTextHistory";
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
 *
 * Панель инструментов (undo/redo, очистка, копировать/вставить) скрыта по умолчанию —
 * открывается тапом по заголовку, чтобы не отжирать место у textarea, когда не нужна.
 */
export function PromptEditorOverlay({ title, placeholder, value, onSave, onCancel }: PromptEditorOverlayProps) {
  const { appearance } = useTheme();
  const { draft, canUndo, canRedo, onChange, commit, undo, redo } = useTextHistory(value);
  const dirty = draft !== value;
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleClear = useCallback(() => {
    if (!draft) return;
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    confirmAction("Весь текст будет удалён.", {
      title: "Очистить текст?",
      confirmText: "Очистить",
    })
      .then((ok) => {
        if (ok) commit("");
      })
      .catch((err) => console.error("Не удалось показать подтверждение очистки текста промпта", err))
      .finally(() => {
        confirmingRef.current = false;
      });
  }, [draft, commit]);

  // Вставляем на месте курсора, а не поверх всего текста — textarea не controlled-onPaste,
  // поэтому позицию курсора берём напрямую из DOM-элемента через ref.
  const handlePasteText = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? draft.length;
      const end = el?.selectionEnd ?? draft.length;
      const next = draft.slice(0, start) + text + draft.slice(end);
      commit(next);
      requestAnimationFrame(() => {
        if (!el) return;
        const caret = start + text.length;
        el.selectionStart = el.selectionEnd = caret;
        el.focus();
      });
    },
    [draft, commit],
  );

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
        <PromptEditorHeader
          title={title}
          dirty={dirty}
          toolbarVisible={toolbarVisible}
          onToggleToolbar={() => setToolbarVisible((v) => !v)}
          onDiscard={handleDiscard}
          onSave={() => onSave(draft)}
        />

        <AnimatePresence initial={false}>
          {toolbarVisible && (
            <motion.div
              key="toolbar"
              className="prompt-editor-overlay__toolbar-wrap"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <PromptEditorToolbar
                draft={draft}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onClear={handleClear}
                onPaste={handlePasteText}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="prompt-editor-overlay__textarea-wrap">
          <textarea
            ref={textareaRef}
            className="prompt-editor-overlay__textarea"
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>
      </AppRoot>
    </motion.div>,
    document.body,
  );
}
