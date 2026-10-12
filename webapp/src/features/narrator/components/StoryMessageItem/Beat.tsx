import { useState } from "react";
import { PromptEditorOverlay } from "../../../../shared/components/PromptEditorOverlay";
import type { StoryMessage } from "../../types/story";
import { BeatActions } from "./BeatActions";
import { BeatText } from "./BeatText";
import type { TranslateControl } from "./translateControl";

interface BeatProps {
  message: StoryMessage;
  displayText: string;
  translate?: TranslateControl;
  /** Последний бит активного пути. */
  isLast: boolean;
  disabled: boolean;
  quickRollbackEnabled: boolean;
  editEnabled: boolean;
  onQuickRollback: (messageId: number) => Promise<void>;
  /** Бросает при неудаче (после своего тоста) — редактор остаётся открытым. */
  onEdit: (messageId: number, content: string) => Promise<void>;
  onSwitchSibling: (siblingId: number) => void;
  onRegenerate: (messageId: number) => void;
  onDelete: (messageId: number) => void;
}

/** Бит истории: проза на всю ширину и действия под ней; правка — в полноэкранном редакторе. */
export function Beat({
  message,
  displayText,
  translate,
  isLast,
  disabled,
  quickRollbackEnabled,
  editEnabled,
  onQuickRollback,
  onEdit,
  onSwitchSibling,
  onRegenerate,
  onDelete,
}: BeatProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Открывающий бит (parentId === null) — авторское начало: его нельзя ни перегенерировать, ни удалить
  // (сервер вернёт 400). Варианты, перегенерация и удаление — только у последнего бита.
  const showTail = isLast && message.parentId !== null;

  // Редактор закрываем только по успеху: он обещает, что набранный текст случайно не потеряется. onEdit
  // при неудаче бросает (тост он уже показал) — редактор остаётся открытым вместе с правкой.
  const handleEditSave = async (content: string) => {
    if (editSaving) return;
    setEditSaving(true);
    try {
      await onEdit(message.id, content);
      setEditorOpen(false);
    } catch (err) {
      // Причину показал onEdit тостом и залогировал — здесь только оставляем редактор открытым.
      console.debug("Beat edit not saved, editor stays open", err);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      <BeatText text={displayText} />
      <BeatActions
        message={message}
        displayText={displayText}
        translate={translate}
        disabled={disabled}
        // Откат — на всех битах, кроме последнего (на нём история и так стоит).
        onRollback={quickRollbackEnabled && !isLast ? () => onQuickRollback(message.id) : undefined}
        // Правка — на любом бите, включая открывающий: курсор истории и граф веток она не трогает.
        onEdit={editEnabled ? () => setEditorOpen(true) : undefined}
        editSaving={editSaving}
        tail={
          showTail
            ? {
                onSwitchSibling,
                onRegenerate: () => onRegenerate(message.id),
                onDelete: () => onDelete(message.id),
              }
            : undefined
        }
      />
      <PromptEditorOverlay
        opened={editorOpen}
        title="Редактирование бита"
        value={message.content}
        onSave={handleEditSave}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}
