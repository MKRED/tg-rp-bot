import { Caption, Spinner, Text } from "@telegram-apps/telegram-ui";
import { Check, ChevronLeft, ChevronRight, Copy, Globe, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { confirmAction } from "../../../shared/telegram/confirm";
import {
  isTranslateActionsPopupAvailable,
  showTranslateActionsPopup,
} from "../../../shared/telegram/translateActionsPopup";
import { RpText } from "../../../shared/components/RpText";
import { TranslateActionModal } from "../../../shared/components/TranslateActionModal";
import { useLongPress } from "../../../shared/hooks/useLongPress";
import type { MessageInPath } from "../types/chat";

interface MessageBubbleProps {
  message: MessageInPath;
  /** Показывать кнопку перевода на этом сообщении (на основе settings.translateScope). */
  showTranslateButton: boolean;
  /** Язык перевода из настроек. */
  targetLang: string;
  /** Автоматически отображать перевод, когда он появится (авто-перевод). */
  autoShowTranslation?: boolean;
  /** Авто-перевод этого сообщения сейчас в полёте — крутить спиннер на кнопке Globe. */
  autoTranslating?: boolean;
  /** Это последнее assistant-сообщение в чате (для кнопки регенерации). */
  isLastAssistant: boolean;
  onSwitchBranch: (siblingId: number) => void;
  onTranslate: (messageId: number, targetLang: string) => Promise<string>;
  /** Пересчитывает перевод заново (игнорируя кэш) — из меню долгого нажатия на Globe. */
  onRetranslate: (messageId: number, targetLang: string) => Promise<void>;
  /** Удаляет закэшированный перевод — из меню долгого нажатия на Globe. */
  onDeleteTranslation: (messageId: number, targetLang: string) => Promise<void>;
  onEdit: (messageId: number) => void;
  onRegenerate: (messageId: number) => void;
  onDelete: (messageId: number) => void;
}

export function MessageBubble({
  message,
  showTranslateButton,
  targetLang,
  autoShowTranslation = false,
  autoTranslating = false,
  isLastAssistant,
  onSwitchBranch,
  onTranslate,
  onRetranslate,
  onDeleteTranslation,
  onEdit,
  onRegenerate,
  onDelete,
}: MessageBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  // Модалка — фоллбэк там, где нативный попап Telegram недоступен (ПК-клиенты, дев-браузер).
  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  const longPress = useLongPress(() => {
    if (isTranslateActionsPopupAvailable()) {
      showTranslateActionsPopup()
        .then((action) => {
          if (action === "regenerate") void handleRegenerateTranslation();
          else if (action === "delete") void handleDeleteTranslationAction();
        })
        .catch((err) => console.error("Failed to show translate actions popup", err));
    } else {
      setTranslateModalOpen(true);
    }
  });

  // Когда авто-перевод доставляет перевод в message.translations — автоматически показываем его.
  useEffect(() => {
    if (autoShowTranslation && message.translations?.[targetLang]) {
      setShowTranslation(true);
    }
  }, [message.translations, targetLang, autoShowTranslation]);
  const [translating, setTranslating] = useState(false);
  // Пендинг регенерации/удаления перевода из меню долгого нажатия — отдельно от translating
  // (тот только для первого перевода по тапу), чтобы кнопка Globe крутила спиннер и на этих действиях.
  const [translateActionPending, setTranslateActionPending] = useState(false);
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

  const handleRegenerateTranslation = async () => {
    setTranslateActionPending(true);
    try {
      await onRetranslate(message.id, targetLang);
    } finally {
      setTranslateActionPending(false);
    }
  };

  const handleDeleteTranslationAction = async () => {
    setShowTranslation(false);
    setTranslateActionPending(true);
    try {
      await onDeleteTranslation(message.id, targetLang);
    } finally {
      setTranslateActionPending(false);
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
        <Text Component="p" className="message-bubble__text"><RpText text={displayText} /></Text>

        {/* Единая строка: перевод, сиблинги (← N/M →) + остальные действия — как в Narrator
            (StoryMessageItem, где Globe идёт первой кнопкой). */}
        <div className="message-bubble__actions">
          {showTranslateButton && (
            <>
              <button
                className={`message-bubble__action-btn${showTranslation ? " message-bubble__action-btn--active" : ""}`}
                onClick={handleTranslateToggle}
                disabled={translating || translateActionPending || autoTranslating}
                type="button"
                aria-label="Перевести"
                {...(message.translations?.[targetLang] ? longPress : {})}
              >
                {translating || translateActionPending || autoTranslating ? <Spinner size="s" /> : <Globe size={16} />}
              </button>
              <TranslateActionModal
                open={translateModalOpen}
                onOpenChange={setTranslateModalOpen}
                onRegenerate={handleRegenerateTranslation}
                onDelete={handleDeleteTranslationAction}
              />
            </>
          )}
          {message.siblingCount > 1 && (
            <span className="message-bubble__siblings">
              <button
                className="message-bubble__action-btn"
                onClick={() => prevSiblingId != null && onSwitchBranch(prevSiblingId)}
                disabled={prevSiblingId == null}
                type="button"
                aria-label="Предыдущий вариант"
              >
                <ChevronLeft size={16} />
              </button>
              <Caption level="1" className="message-bubble__sibling-count">
                {message.siblingIndex + 1}/{message.siblingCount}
              </Caption>
              <button
                className="message-bubble__action-btn"
                onClick={() => nextSiblingId != null && onSwitchBranch(nextSiblingId)}
                disabled={nextSiblingId == null}
                type="button"
                aria-label="Следующий вариант"
              >
                <ChevronRight size={16} />
              </button>
            </span>
          )}
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
    </div>
  );
}
