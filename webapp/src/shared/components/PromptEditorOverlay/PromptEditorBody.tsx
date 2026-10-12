import { Collapse } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { pushBackInterceptor } from "../../telegram/backInterceptor";
import { confirmAction } from "../../telegram/confirm";
import { useToast } from "../../toast";
import { PromptEditorHeader } from "./PromptEditorHeader";
import { PromptEditorToolbar } from "./PromptEditorToolbar";
import { PromptEditorTranslateToolbar, type TranslateBuffer } from "./PromptEditorTranslateToolbar";
import { useTextHistory } from "./useTextHistory";
import { usePromptTranslate } from "./usePromptTranslate";
import styles from "./PromptEditorOverlay.module.css";

type ToolbarKind = "text" | "translate";

interface PromptEditorBodyProps {
  title: string;
  placeholder?: string;
  value: string;
  /** false — окно уже закрывается (анимация выхода): «Назад» и Escape больше не обрабатываем. */
  opened: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/**
 * Тело редактора: шапка, раскрываемая панель, поле. Закрыть случайно нельзя: «Отмена», Escape и
 * «Назад» Telegram при правках спрашивают подтверждение (confirmAction).
 *
 * Панель инструментов (undo/redo, очистка, копировать/вставить) скрыта по умолчанию — открывается тапом
 * по заголовку, чтобы не отнимать место у поля.
 *
 * Второй режим панели — перевод (toolbarKind). Два независимых буфера со своими историями (source —
 * исходный текст, translation — рабочий перевод; НИКОГДА не общий стек — иначе undo прыгал бы между
 * языками). activeBuffer — какой буфер сейчас в поле, независимо от показанной панели. Перевод живёт
 * только пока открыт редактор; onSave ВСЕГДА пишет source. Чтобы перевод стал итоговым текстом, его
 * сначала переносят «Применить» (usePromptTranslate.applyTranslation — без повторного перевода).
 * Модель синхронизации по абзацам — usePromptTranslate.ts и translateBlocks.ts.
 */
export function PromptEditorBody({ title, placeholder, value, opened, onSave, onCancel }: PromptEditorBodyProps) {
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
  // Неперенесённый перевод молча потерялся бы при закрытии/сохранении (onSave пишет только source),
  // поэтому это отдельный повод для подтверждения, не просто dirty.
  const hasUnsavedWork = dirty || promptTranslate.hasUnsyncedTranslation;

  // Общая обёртка подтверждений: одно окно за раз, ошибка показа — в лог.
  const confirmThen = useCallback(
    (message: string, title: string, confirmText: string, action: () => void, destructive = true) => {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      confirmAction(message, { title, confirmText, destructive })
        .then((ok) => {
          if (ok) action();
        })
        .catch((err) => console.error("Не удалось показать подтверждение в редакторе промпта", err))
        .finally(() => {
          confirmingRef.current = false;
        });
    },
    [],
  );

  const handleDiscard = useCallback(() => {
    if (!hasUnsavedWork) {
      onCancel();
      return;
    }
    confirmThen("Изменения не будут сохранены.", "Закрыть без сохранения?", "Закрыть", onCancel);
  }, [hasUnsavedWork, onCancel, confirmThen]);

  const handleSave = useCallback(() => {
    if (confirmingRef.current) return;
    if (!promptTranslate.hasUnsyncedTranslation) {
      onSave(source.draft);
      return;
    }
    confirmThen(
      "Переведённый текст не перенесён в оригинал — сохранится исходный текст.",
      "Сохранить без переноса перевода?",
      "Сохранить",
      () => onSave(source.draft),
      false,
    );
  }, [promptTranslate.hasUnsyncedTranslation, onSave, source.draft, confirmThen]);

  const handleClear = useCallback(() => {
    if (!active.draft) return;
    confirmThen("Весь текст будет удалён.", "Очистить текст?", "Очистить", () => active.commit(""));
  }, [active, confirmThen]);

  // Вставляем на месте курсора, а не поверх всего текста; позицию берём из DOM через ref. Через
  // active — иначе при просмотре перевода вставка попала бы в невидимый буфер оригинала.
  const handlePasteText = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? active.draft.length;
      const end = el?.selectionEnd ?? active.draft.length;
      active.commit(active.draft.slice(0, start) + text + active.draft.slice(end));
      requestAnimationFrame(() => {
        if (!el) return;
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
      });
    },
    [active],
  );

  // Курсор — в конец текста: обычно дописывают, а фокус окна ставит его в начало.
  useEffect(() => {
    const el = textareaRef.current;
    if (el) el.selectionStart = el.selectionEnd = el.value.length;
  }, []);

  // Нативная «Назад» закрывает редактор (с подтверждением при правках), а не уводит со страницы.
  // На время анимации закрытия перехват снимаем — иначе «Назад» открыл бы второе подтверждение.
  useEffect(() => (opened ? pushBackInterceptor(handleDiscard) : undefined), [opened, handleDiscard]);

  // Escape — тот же путь. Слушаем в фазе захвата и пропускаем, если Escape закрывает открытый список
  // языка: Select на это время ставит полю data-mantine-stop-propagation (так же делает Modal Mantine),
  // а preventDefault не зовёт, и к фазе всплытия атрибут уже снят.
  useWindowEvent(
    "keydown",
    (e) => {
      if (!opened || e.key !== "Escape") return;
      if ((e.target as HTMLElement | null)?.getAttribute?.("data-mantine-stop-propagation") === "true") return;
      handleDiscard();
    },
    { capture: true },
  );

  return (
    <div className={styles.body}>
      <PromptEditorHeader
        title={title}
        dirty={dirty}
        toolbarVisible={toolbarVisible}
        onToggleToolbar={() => setToolbarVisible((v) => !v)}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      <Collapse expanded={toolbarVisible} className={styles.toolbarWrap}>
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
            canApplyTranslation={promptTranslate.canApplyTranslation}
            onApplyTranslation={promptTranslate.applyTranslation}
          />
        )}
      </Collapse>

      {/* Обычный textarea, а не Textarea Mantine: полю на весь экран не нужны рамка и обёртка формы. */}
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={active.draft}
        onChange={(e) => active.onChange(e.target.value)}
        placeholder={activeBuffer === "translation" ? "Текст перевода…" : placeholder}
        aria-label={title}
        data-autofocus
      />
    </div>
  );
}
