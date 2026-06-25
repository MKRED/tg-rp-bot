import { ChevronLeft, ChevronRight, Clapperboard, RefreshCw, Trash2 } from "lucide-react";
import { RpText } from "../../../shared/components/RpText";
import type { StoryMessage } from "../types/story";

interface StoryMessageItemProps {
  message: StoryMessage;
  /** Последний бит активного пути — под ним показываем действия (реген/удаление/ветки). */
  isLast: boolean;
  disabled: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
  onSwitchSibling: (siblingId: number) => void;
}

/**
 * Один элемент ленты истории. continue-ходы скрыты; directive — компактный чип «режиссёр»;
 * beat — текст истории (с сохранением переносов). Под последним битом — панель действий.
 */
export function StoryMessageItem({
  message,
  isLast,
  disabled,
  onRegenerate,
  onDelete,
  onSwitchSibling,
}: StoryMessageItemProps) {
  // Технические «Дальше» в ленте не показываем.
  if (message.kind === "continue") return null;

  if (message.kind === "directive") {
    return (
      <div
        style={{
          alignSelf: "center",
          display: "flex",
          alignItems: "center",
          gap: 6,
          margin: "6px 0",
          padding: "4px 10px",
          borderRadius: 12,
          background: "var(--tgui--secondary_bg_color)",
          color: "var(--tgui--hint_color)",
          fontSize: 13,
          maxWidth: "85%",
        }}
      >
        <Clapperboard size={14} />
        <span>{message.content}</span>
      </div>
    );
  }

  // beat (assistant)
  const canSwitch = message.siblingCount > 1;
  const prevSibling = message.siblings[message.siblingIndex - 1];
  const nextSibling = message.siblings[message.siblingIndex + 1];
  // Корневой openingBeat (parentId === null) — авторское открытие: его нельзя ни регенерировать,
  // ни удалить (сервер вернёт 400), поэтому панель действий под ним не показываем.
  const isOpening = message.parentId === null;
  const showActions = isLast && !isOpening;

  return (
    <div style={{ margin: "8px 0" }}>
      <div
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.5,
          color: "var(--tgui--text_color)",
        }}
      >
        <RpText text={message.content} />
      </div>

      {showActions && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, color: "var(--tgui--hint_color)" }}>
          {canSwitch && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
              <button
                type="button"
                disabled={disabled || prevSibling === undefined}
                onClick={() => prevSibling !== undefined && onSwitchSibling(prevSibling)}
                style={iconBtn}
                aria-label="Предыдущий вариант"
              >
                <ChevronLeft size={16} />
              </button>
              {message.siblingIndex + 1}/{message.siblingCount}
              <button
                type="button"
                disabled={disabled || nextSibling === undefined}
                onClick={() => nextSibling !== undefined && onSwitchSibling(nextSibling)}
                style={iconBtn}
                aria-label="Следующий вариант"
              >
                <ChevronRight size={16} />
              </button>
            </span>
          )}
          <button type="button" disabled={disabled} onClick={onRegenerate} style={iconBtn} aria-label="Перегенерировать">
            <RefreshCw size={16} />
          </button>
          <button type="button" disabled={disabled} onClick={onDelete} style={iconBtn} aria-label="Удалить">
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  padding: 2,
};
