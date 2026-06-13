import { Avatar } from "@telegram-apps/telegram-ui";
import { Check, ChevronLeft, ChevronRight, Copy, Globe, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { CharacterAvatar } from "../../characters/components/CharacterAvatar";
import { PersonaAvatar } from "../../personas/components/PersonaAvatar";
import { getTgUser } from "../../../shared/telegram/initData";
import { confirmAction } from "../../../shared/telegram/confirm";
import type { MessageInPath } from "../types/chat";
import { RpText } from "./RpText";

interface MessageBubbleProps {
  message: MessageInPath;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string; hasImage: boolean } | null;
  /** Показывать кнопку перевода на этом сообщении (на основе settings.translateScope). */
  showTranslateButton: boolean;
  /** Язык перевода из настроек. */
  targetLang: string;
  /** Это последнее assistant-сообщение в чате (для кнопки регенерации). */
  isLastAssistant: boolean;
  onSwitchBranch: (siblingId: number) => void;
  onTranslate: (messageId: number, targetLang: string) => Promise<string>;
  onEdit: (messageId: number) => void;
  onRegenerate: (messageId: number) => void;
  onDelete: (messageId: number) => void;
}

export function MessageBubble({
  message,
  character,
  persona,
  showTranslateButton,
  targetLang,
  isLastAssistant,
  onSwitchBranch,
  onTranslate,
  onEdit,
  onRegenerate,
  onDelete,
}: MessageBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";
  const user = getTgUser();

  const displayText =
    showTranslation && message.translations?.[targetLang]
      ? message.translations[targetLang]
      : message.content;

  const handleTranslateToggle = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    // Если перевод уже есть в кэше — просто показываем
    if (message.translations?.[targetLang]) {
      setShowTranslation(true);
      return;
    }
    // Запрашиваем перевод
    setTranslating(true);
    try {
      await onTranslate(message.id, targetLang);
      setShowTranslation(true);
    } finally {
      setTranslating(false);
    }
  };

  const prevSiblingId =
    message.siblingCount > 1 && message.siblingIndex > 0
      ? message.siblings[message.siblingIndex - 1]
      : null;
  const nextSiblingId =
    message.siblingCount > 1 && message.siblingIndex < message.siblingCount - 1
      ? message.siblings[message.siblingIndex + 1]
      : null;

  return (
    <div className={`message-bubble message-bubble--${message.role}`}>
      {isAssistant && (
        <CharacterAvatar
          id={character.id}
          hasImage={character.hasImage}
          name={character.name}
          size={28}
        />
      )}

      <div className="message-bubble__body">
        <p className="message-bubble__text"><RpText text={displayText} /></p>

        {/* Строка сиблингов: стрелки ← N/M → */}
        {message.siblingCount > 1 && (
          <div className="message-bubble__siblings">
            <button
              className="message-bubble__sibling-btn"
              onClick={() => prevSiblingId != null && onSwitchBranch(prevSiblingId)}
              disabled={prevSiblingId == null}
              type="button"
              aria-label="Предыдущий вариант"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="message-bubble__sibling-count">
              {message.siblingIndex + 1}/{message.siblingCount}
            </span>
            <button
              className="message-bubble__sibling-btn"
              onClick={() => nextSiblingId != null && onSwitchBranch(nextSiblingId)}
              disabled={nextSiblingId == null}
              type="button"
              aria-label="Следующий вариант"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Действия: перевод, копирование, редактирование, регенерация */}
        <div className="message-bubble__actions">
          <button
            className="message-bubble__action-btn"
            onClick={() => {
              navigator.clipboard.writeText(displayText).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            type="button"
            aria-label="Скопировать"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          {showTranslateButton && (
            <button
              className={`message-bubble__action-btn${showTranslation ? " message-bubble__action-btn--active" : ""}`}
              onClick={handleTranslateToggle}
              disabled={translating}
              type="button"
              aria-label="Перевести"
            >
              <Globe size={16} />
            </button>
          )}
          <button
            className="message-bubble__action-btn"
            onClick={() => onEdit(message.id)}
            type="button"
            aria-label="Редактировать"
          >
            <Pencil size={16} />
          </button>
          {isAssistant && isLastAssistant && (
            <button
              className="message-bubble__action-btn"
              onClick={() => onRegenerate(message.id)}
              type="button"
              aria-label="Регенерировать"
            >
              <RefreshCw size={16} />
            </button>
          )}
          <button
            className="message-bubble__action-btn message-bubble__action-btn--danger"
            onClick={async () => {
              const ok = await confirmAction("Удалить сообщение? Это действие необратимо.", {
                title: "Удаление сообщения",
                confirmText: "Удалить",
              });
              if (ok) onDelete(message.id);
            }}
            type="button"
            aria-label="Удалить"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {!isAssistant && (
        persona
          ? <PersonaAvatar id={persona.id} hasImage={persona.hasImage} name={persona.name} size={28} />
          : <Avatar size={28} acronym={user?.firstName?.charAt(0).toUpperCase() ?? "?"} />
      )}
    </div>
  );
}
