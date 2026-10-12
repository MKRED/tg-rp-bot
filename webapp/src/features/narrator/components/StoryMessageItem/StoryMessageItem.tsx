import { useState } from "react";
import { TranslateActionModal } from "../../../../shared/components/TranslateActionModal";
import { useLongPress } from "../../../../shared/hooks/useLongPress";
import { useTranslatable } from "../../../../shared/hooks/useTranslatable";
import {
  isTranslateActionsPopupAvailable,
  showTranslateActionsPopup,
} from "../../../../shared/telegram/translateActionsPopup";
import type { StoryMessage } from "../../types/story";
import { Beat } from "./Beat";
import { DirectiveChip } from "./DirectiveChip";
import type { TranslateControl } from "./translateControl";

interface StoryMessageItemProps {
  message: StoryMessage;
  /** Последний бит активного пути (и генерации сейчас нет). */
  isLast: boolean;
  /** Идёт генерация — действия, меняющие историю, недоступны. */
  disabled: boolean;
  /** Кнопка перевода на этом сообщении (settings.translateScope + роль). */
  showTranslateButton: boolean;
  /** Язык перевода из настроек истории. */
  targetLang: string;
  /** Сразу показывать перевод, когда он появится (автоперевод). */
  autoShowTranslation: boolean;
  /** Автоперевод этого сообщения сейчас в полёте — спиннер на кнопке перевода. */
  autoTranslating: boolean;
  onTranslate: (messageId: number, targetLang: string) => Promise<string>;
  /** Перевести заново мимо кэша — меню долгого нажатия на кнопке перевода. */
  onRetranslate: (messageId: number, targetLang: string) => Promise<void>;
  /** Удалить закэшированный перевод — меню долгого нажатия на кнопке перевода. */
  onDeleteTranslation: (messageId: number, targetLang: string) => Promise<void>;
  quickRollbackEnabled: boolean;
  editEnabled: boolean;
  onQuickRollback: (messageId: number) => Promise<void>;
  onEdit: (messageId: number, content: string) => Promise<void>;
  onSwitchSibling: (siblingId: number) => void;
  onRegenerate: (messageId: number) => void;
  onDelete: (messageId: number) => void;
}

/**
 * Сообщение ленты истории: директива — чип режиссёра, бит — проза с действиями. Здесь же общая для
 * обоих перевода: тап — перевод/оригинал, долгое нажатие при кэше — «перевести заново / удалить»
 * (нативный попап Telegram, вне его — окно). Технические «Дальше» лента не рисует.
 */
export function StoryMessageItem({
  message,
  showTranslateButton,
  targetLang,
  autoShowTranslation,
  autoTranslating,
  onTranslate,
  onRetranslate,
  onDeleteTranslation,
  ...beatProps
}: StoryMessageItemProps) {
  const { displayText, showTranslation, translating, toggle } = useTranslatable(
    message,
    targetLang,
    autoShowTranslation,
    onTranslate,
  );
  // «Заново» и удаление перевода — отдельно от translating (первый перевод по тапу), чтобы кнопка
  // крутила спиннер и на этих действиях.
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

  const translate: TranslateControl | undefined = showTranslateButton
    ? {
        active: showTranslation,
        pending: translating || actionPending || autoTranslating,
        // Ошибку перевода уже показал тостом useStoryTranslation — здесь только лог.
        onToggle: () => void toggle().catch((err) => console.warn("Translate toggle failed", err)),
        longPress: message.translations?.[targetLang] ? longPress : undefined,
      }
    : undefined;

  return (
    <>
      {message.kind === "directive" ? (
        <DirectiveChip text={displayText} translate={translate} />
      ) : (
        <Beat message={message} displayText={displayText} translate={translate} {...beatProps} />
      )}
      {showTranslateButton && (
        <TranslateActionModal
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          onRegenerate={retranslate}
          onDelete={deleteTranslation}
        />
      )}
    </>
  );
}
