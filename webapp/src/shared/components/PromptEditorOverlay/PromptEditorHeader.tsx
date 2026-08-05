import { Button, Subheadline } from "@telegram-apps/telegram-ui";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PromptEditorHeaderProps {
  title: string;
  dirty: boolean;
  toolbarVisible: boolean;
  onToggleToolbar: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

/** Шапка оверлея: Отмена / заголовок (тап разворачивает панель инструментов) / Готово. */
export function PromptEditorHeader({
  title,
  dirty,
  toolbarVisible,
  onToggleToolbar,
  onDiscard,
  onSave,
}: PromptEditorHeaderProps) {
  return (
    <div className="prompt-editor-overlay__header">
      <Button mode="outline" size="s" onClick={onDiscard}>
        Отмена
      </Button>
      <button
        type="button"
        className="prompt-editor-overlay__title-toggle"
        onClick={onToggleToolbar}
        aria-expanded={toolbarVisible}
        aria-label={toolbarVisible ? "Скрыть инструменты" : "Показать инструменты"}
      >
        <Subheadline level="1" weight="2" className="prompt-editor-overlay__title" plain>
          {title}
        </Subheadline>
        {toolbarVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <Button mode="filled" size="s" disabled={!dirty} onClick={onSave}>
        Готово
      </Button>
    </div>
  );
}
