import { Spinner } from "@telegram-apps/telegram-ui";
import { Check, ChevronLeft, ChevronRight, Copy, Globe, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { confirmAction } from "../../../shared/telegram/confirm";
import type { MessageInPath } from "../types/chat";
import { RpText } from "./RpText";

interface MessageBubbleProps {
  message: MessageInPath;
  /** Показывать кнопку перевода на этом сообщении (на основе settings.translateScope). */
  showTranslateButton: boolean;
  /** Язык перевода из настроек. */
  targetLang: string;
  /** Автоматически отображать перевод, когда он появится (авто-перевод). */
  autoShowTranslation?: boolean;
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
  showTranslateButton,
  targetLang,
  autoShowTranslation = false,
  isLastAssistant,
  onSwitchBranch,
  onTranslate,
  onEdit,
  onRegenerate,
  onDelete,
}: MessageBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(false);

  // Когда авто-перевод доставляет перевод в message.translations — автоматически показываем его.
  useEffect(() => {
    if (autoShowTranslation && message.translations?.[targetLang]) {
      setShowTranslation(true);
    }
  }, [message.translations, targetLang, autoShowTranslation]);
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";

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
              <ChevronLeft size={20} />
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
              <ChevronRight size={20} />
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
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
          {showTranslateButton && (
            <button
              className={`message-bubble__action-btn${showTranslation ? " message-bubble__action-btn--active" : ""}`}
              onClick={handleTranslateToggle}
              disabled={translating}
              type="button"
              aria-label="Перевести"
            >
              {translating ? <Spinner size="s" /> : <Globe size={20} />}
            </button>
          )}
          <button
            className="message-bubble__action-btn"
            onClick={() => onEdit(message.id)}
            type="button"
            aria-label="Редактировать"
          >
            <Pencil size={20} />
          </button>
          {isAssistant && isLastAssistant && (
            <button
              className="message-bubble__action-btn"
              onClick={() => onRegenerate(message.id)}
              type="button"
              aria-label="Регенерировать"
            >
              <RefreshCw size={20} />
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
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
