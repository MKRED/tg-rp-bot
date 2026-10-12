import { Text } from "@mantine/core";
import { useState } from "react";
import { RpText } from "../../../../shared/components/RpText";
import { TranslateActionModal } from "../../../../shared/components/TranslateActionModal";
import { useLongPress } from "../../../../shared/hooks/useLongPress";
import { useTranslatable } from "../../../../shared/hooks/useTranslatable";
import {
  isTranslateActionsPopupAvailable,
  showTranslateActionsPopup,
} from "../../../../shared/telegram/translateActionsPopup";
import type { MessageInPath } from "../../types/chat";
import { MessageActions } from "./MessageActions";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  message: MessageInPath;
  /** Показывать кнопку перевода на этом сообщении (settings.translateScope). */
  showTranslateButton: boolean;
  /** Язык перевода из настроек. */
  targetLang: string;
  /** Сразу показывать перевод, когда он появится (автоперевод). */
  autoShowTranslation?: boolean;
  /** Автоперевод этого сообщения сейчас в полёте — крутить спиннер на кнопке перевода. */
  autoTranslating?: boolean;
  /** Последний ответ ИИ в чате — только его можно перегенерировать. */
  isLastAssistant: boolean;
  onSwitchBranch: (siblingId: number) => void;
  onTranslate: (messageId: number, targetLang: string) => Promise<string>;
  /** Пересчитать перевод заново (игнорируя кэш) — меню долгого нажатия на кнопке перевода. */
  onRetranslate: (messageId: number, targetLang: string) => Promise<void>;
  /** Удалить закэшированный перевод — меню долгого нажатия на кнопке перевода. */
  onDeleteTranslation: (messageId: number, targetLang: string) => Promise<void>;
  onEdit: (messageId: number) => void;
  onRegenerate: (messageId: number) => void;
  onDelete: (messageId: number) => void;
}

/** Сообщение ленты: пузырь (свои — справа акцентом, ответы ИИ — слева на фоне карточки) и действия под ним. */
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
  const { displayText, showTranslation, translating, toggle } = useTranslatable(
    message,
    targetLang,
    autoShowTranslation,
    onTranslate,
  );
  // Перевести заново / удалить перевод из меню долгого нажатия — отдельно от translating (первый
  // перевод по тапу), чтобы кнопка крутила спиннер и на этих действиях.
  const [actionPending, setActionPending] = useState(false);
  // Окно действий — там, где нативного попапа Telegram нет (ПК-клиенты, браузер).
  const [actionsOpen, setActionsOpen] = useState(false);

  const runAction = async (action: (id: number, lang: string) => Promise<void>) => {
    setActionPending(true);
    try {
      await action(message.id, targetLang);
    } finally {
      setActionPending(false);
    }
  };
  const retranslate = () => void runAction(onRetranslate);
  const deleteTranslation = () => void runAction(onDeleteTranslation);

  const longPress = useLongPress(() => {
    if (!isTranslateActionsPopupAvailable()) {
      setActionsOpen(true);
      return;
    }
    showTranslateActionsPopup()
      .then((action) => {
        if (action === "regenerate") retranslate();
        else if (action === "delete") deleteTranslation();
      })
      .catch((err) => console.error("Failed to show translate actions popup", err));
  });

  const hasCachedTranslation = Boolean(message.translations?.[targetLang]);

  return (
    <div className={styles.row} data-role={message.role}>
      <div className={styles.column}>
        <Text component="div" className={styles.bubble}>
          <RpText text={displayText} />
        </Text>
        <MessageActions
          message={message}
          displayText={displayText}
          translate={
            showTranslateButton
              ? {
                  active: showTranslation,
                  pending: translating || actionPending || autoTranslating,
                  // Ошибку перевода уже показал тостом экран (handleTranslate) — здесь только лог.
                  onToggle: () => void toggle().catch((err) => console.warn("Translate toggle failed", err)),
                  longPress: hasCachedTranslation ? longPress : undefined,
                }
              : undefined
          }
          canRegenerate={message.role === "assistant" && isLastAssistant}
          onSwitchBranch={onSwitchBranch}
          onEdit={() => onEdit(message.id)}
          onRegenerate={() => onRegenerate(message.id)}
          onDelete={() => onDelete(message.id)}
        />
      </div>
      {showTranslateButton && (
        <TranslateActionModal
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          onRegenerate={retranslate}
          onDelete={deleteTranslation}
        />
      )}
    </div>
  );
}
