import { Check, ClipboardPaste, Copy, Languages, Redo2, Trash2, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";

interface PromptEditorToolbarProps {
  draft: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  /** Текст уже прочитан из буфера обмена — вставка на месте курсора остаётся за родителем (он держит ref textarea). */
  onPaste: (text: string) => void;
  /** Очистка недоступна в режиме перевода (viewer сейчас показывает translation-буфер — см. PromptEditorOverlay). */
  clearDisabled?: boolean;
  /** Переключает бар на PromptEditorTranslateToolbar (второй режим панели). */
  onOpenTranslate: () => void;
}

/**
 * Панель инструментов для работы с текстом промпта — читает/пишет буфер обмена сама
 * (единственный источник clipboard-вызовов), а вставку на месте курсора и историю
 * undo/redo делегирует родителю, у которого есть ref textarea и стек истории.
 */
export function PromptEditorToolbar({
  draft,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onPaste,
  clearDisabled,
  onOpenTranslate,
}: PromptEditorToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(draft)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch((err) => console.error("Не удалось скопировать текст промпта", err));
  }, [draft]);

  const handlePaste = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) onPaste(text);
      })
      .catch((err) => console.error("Не удалось прочитать буфер обмена", err));
  }, [onPaste]);

  return (
    <div className="prompt-editor-overlay__toolbar">
      <button
        className="prompt-editor-overlay__toolbar-btn prompt-editor-overlay__toolbar-btn--danger"
        onClick={onClear}
        disabled={!draft || clearDisabled}
        type="button"
        aria-label="Очистить текст"
      >
        <Trash2 size={18} />
      </button>

      <span className="prompt-editor-overlay__toolbar-divider" />

      <button
        className="prompt-editor-overlay__toolbar-btn"
        onClick={handleCopy}
        disabled={!draft}
        type="button"
        aria-label="Скопировать"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
      <button
        className="prompt-editor-overlay__toolbar-btn"
        onClick={handlePaste}
        type="button"
        aria-label="Вставить"
      >
        <ClipboardPaste size={18} />
      </button>
      <button
        className="prompt-editor-overlay__toolbar-btn"
        onClick={onOpenTranslate}
        type="button"
        aria-label="Режим перевода"
      >
        <Languages size={18} />
      </button>

      {/* margin-left: auto на первой кнопке группы прижимает Undo/Redo к правому краю панели */}
      <button
        className="prompt-editor-overlay__toolbar-btn prompt-editor-overlay__toolbar-btn--push"
        onClick={onUndo}
        disabled={!canUndo}
        type="button"
        aria-label="Отменить"
      >
        <Undo2 size={18} />
      </button>
      <button
        className="prompt-editor-overlay__toolbar-btn"
        onClick={onRedo}
        disabled={!canRedo}
        type="button"
        aria-label="Повторить"
      >
        <Redo2 size={18} />
      </button>
    </div>
  );
}
