import { AppRoot } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPlatform } from "../../telegram/platform";
import { pushBackInterceptor } from "../../telegram/backInterceptor";
import { confirmAction } from "../../telegram/confirm";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useTheme } from "../../theme";
import { useToast } from "../../toast";
import { PromptEditorHeader } from "./PromptEditorHeader";
import { PromptEditorToolbar } from "./PromptEditorToolbar";
import { PromptEditorTranslateToolbar, type TranslateBuffer } from "./PromptEditorTranslateToolbar";
import { useTextHistory } from "./useTextHistory";
import { usePromptTranslate } from "./usePromptTranslate";
import "./PromptEditorOverlay.css";

// Платформа сессии не меняется — маппим в стиль telegram-ui один раз, как в App.tsx.
const rawPlatform = getPlatform();
const platform: "ios" | "base" = rawPlatform === "ios" || rawPlatform === "macos" ? "ios" : "base";

type ToolbarKind = "text" | "translate";

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
 *
 * Второй режим панели — перевод (toolbarKind, кнопка Languages в PromptEditorToolbar). Два
 * независимых буфера/истории (source — исходный текст поля, translation — рабочий перевод,
 * useTextHistory х2, НИКОГДА не общий стек — иначе undo прыгал бы между языками): activeBuffer
 * определяет, какой из них сейчас в textarea, независимо от того, какой БАР сейчас показан
 * (toolbarKind) — можно смотреть текстовые инструменты, продолжая редактировать перевод. Состояние
 * перевода эфемерно на сессию оверлея (как и обычный draft — теряется без сохранения при закрытии);
 * onSave ВСЕГДА пишет только source — перевод в сущность не сохраняется. См. usePromptTranslate.ts
 * и translateBlocks.ts за моделью синхронизации по абзацам.
 */
export function PromptEditorOverlay({ title, placeholder, value, onSave, onCancel }: PromptEditorOverlayProps) {
  const { appearance } = useTheme();
  const { showToast } = useToast();
  const source = useTextHistory(value);
  const translation = useTextHistory("");
  const dirty = source.draft !== value;
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarKind, setToolbarKind] = useState<ToolbarKind>("text");
  const [activeBuffer, setActiveBuffer] = useState<TranslateBuffer>("source");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Не даём открыть второй confirm поверх уже открытого при повторном нажатии «Назад»/«Готово».
  const confirmingRef = useRef(false);

  useBodyScrollLock();

  const promptTranslate = usePromptTranslate(
    source.draft,
    translation.draft,
    translation.reset,
    source.commit,
    setActiveBuffer,
  );

  useEffect(() => {
    if (promptTranslate.error) showToast({ type: "error", message: promptTranslate.error });
  }, [promptTranslate.error, showToast]);

  const active = activeBuffer === "translation" ? translation : source;
  // Есть контент в переводе, ещё не перенесённый в source — потеряется молча при закрытии/сохранении
  // (onSave пишет только source), поэтому это отдельный повод для confirm, не просто dirty.
  const hasUnsavedWork = dirty || promptTranslate.hasUnsyncedTranslation;

  const handleDiscard = useCallback(() => {
    if (!hasUnsavedWork) {
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
  }, [hasUnsavedWork, onCancel]);

  const handleSave = useCallback(() => {
    if (confirmingRef.current) return;
    if (!promptTranslate.hasUnsyncedTranslation) {
      onSave(source.draft);
      return;
    }
    confirmingRef.current = true;
    confirmAction("Переведённый текст не перенесён в оригинал — сохранится исходный текст.", {
      title: "Сохранить без переноса перевода?",
      confirmText: "Сохранить",
    })
      .then((ok) => {
        if (ok) onSave(source.draft);
      })
      .catch((err) => console.error("Не удалось показать подтверждение сохранения редактора промпта", err))
      .finally(() => {
        confirmingRef.current = false;
      });
  }, [promptTranslate.hasUnsyncedTranslation, onSave, source.draft]);

  const handleClear = useCallback(() => {
    if (!active.draft) return;
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    confirmAction("Весь текст будет удалён.", {
      title: "Очистить текст?",
      confirmText: "Очистить",
    })
      .then((ok) => {
        if (ok) active.commit("");
      })
      .catch((err) => console.error("Не удалось показать подтверждение очистки текста промпта", err))
      .finally(() => {
        confirmingRef.current = false;
      });
  }, [active]);

  // Вставляем на месте курсора, а не поверх всего текста — textarea не controlled-onPaste,
  // поэтому позицию курсора берём напрямую из DOM-элемента через ref. Работает через active —
  // иначе при просмотре перевода вставка попала бы в невидимый буфер оригинала.
  const handlePasteText = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? active.draft.length;
      const end = el?.selectionEnd ?? active.draft.length;
      const next = active.draft.slice(0, start) + text + active.draft.slice(end);
      active.commit(next);
      requestAnimationFrame(() => {
        if (!el) return;
        const caret = start + text.length;
        el.selectionStart = el.selectionEnd = caret;
        el.focus();
      });
    },
    [active],
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
          onSave={handleSave}
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
              {toolbarKind === "text" ? (
                <PromptEditorToolbar
                  draft={active.draft}
                  canUndo={active.canUndo}
                  canRedo={active.canRedo}
                  onUndo={active.undo}
                  onRedo={active.redo}
                  onClear={handleClear}
                  onPaste={handlePasteText}
                  clearDisabled={activeBuffer === "translation"}
                  onOpenTranslate={() => setToolbarKind("translate")}
                />
              ) : (
                <PromptEditorTranslateToolbar
                  onBack={() => setToolbarKind("text")}
                  engine={promptTranslate.engine}
                  onEngineChange={promptTranslate.setEngine}
                  sourceLang={promptTranslate.sourceLang}
                  onSourceLangChange={promptTranslate.setSourceLang}
                  targetLang={promptTranslate.targetLang}
                  onTargetLangChange={promptTranslate.setTargetLang}
                  onSwapLangs={promptTranslate.swapLangs}
                  activeBuffer={activeBuffer}
                  onActiveBufferChange={setActiveBuffer}
                  loading={promptTranslate.loading}
                  canSyncToTranslation={promptTranslate.canSyncToTranslation}
                  canSyncToSource={promptTranslate.canSyncToSource}
                  onSyncToTranslation={promptTranslate.syncToTranslation}
                  onSyncToSource={promptTranslate.syncToSource}
                  sourceDirtyCount={promptTranslate.sourceDirtyCount}
                  translationDirtyCount={promptTranslate.translationDirtyCount}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="prompt-editor-overlay__textarea-wrap">
          <textarea
            ref={textareaRef}
            className="prompt-editor-overlay__textarea"
            value={active.draft}
            onChange={(e) => active.onChange(e.target.value)}
            placeholder={activeBuffer === "translation" ? "Текст перевода…" : placeholder}
            autoFocus
          />
        </div>
      </AppRoot>
    </motion.div>,
    document.body,
  );
}
