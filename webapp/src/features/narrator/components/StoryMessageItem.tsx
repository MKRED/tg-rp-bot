import { Caption, Spinner } from "@telegram-apps/telegram-ui";
import { ChevronLeft, ChevronRight, Clapperboard, Globe, History, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { RpText } from "../../../shared/components/RpText";
import { TranslateActionModal } from "../../../shared/components/TranslateActionModal";
import { useLongPress } from "../../../shared/hooks/useLongPress";
import {
  isTranslateActionsPopupAvailable,
  showTranslateActionsPopup,
} from "../../../shared/telegram/translateActionsPopup";
import { useTranslatable } from "../hooks/useTranslatable";
import type { StoryMessage } from "../types/story";

interface StoryMessageItemProps {
  message: StoryMessage;
  /** Последний бит активного пути — под ним показываем действия (реген/удаление/ветки). */
  isLast: boolean;
  disabled: boolean;
  /** Показывать кнопку перевода на этом сообщении (по settings.translateScope + роли). */
  showTranslateButton: boolean;
  /** Язык перевода из настроек истории. */
  targetLang: string;
  /** Сразу показывать перевод, когда он появится (авто-перевод). */
  autoShowTranslation?: boolean;
  /** Авто-перевод этого сообщения сейчас в полёте — крутить спиннер на кнопке Globe. */
  autoTranslating?: boolean;
  onTranslate: (messageId: number, targetLang: string) => Promise<string>;
  /** Пересчитывает перевод заново (игнорируя кэш) — из меню долгого нажатия на Globe. */
  onRetranslate: (messageId: number, targetLang: string) => Promise<void>;
  /** Удаляет закэшированный перевод — из меню долгого нажатия на Globe. */
  onDeleteTranslation: (messageId: number, targetLang: string) => Promise<void>;
  onRegenerate: () => void;
  onDelete: () => void;
  onSwitchSibling: (siblingId: number) => void;
  /** Настройка «быстрый откат» включена в чате — показывать кнопку отката на не-последних битах. */
  quickRollbackEnabled: boolean;
  onQuickRollback: (messageId: number) => Promise<void>;
}

/**
 * Один элемент ленты истории. continue-ходы скрыты; directive — компактный чип «режиссёр»
 * (с маленькой кнопкой перевода справа); beat — текст истории. Под последним битом — панель действий,
 * кнопка перевода — на любом бите/директиве согласно настройкам.
 */
export function StoryMessageItem({
  message,
  isLast,
  disabled,
  showTranslateButton,
  targetLang,
  autoShowTranslation = false,
  autoTranslating = false,
  onTranslate,
  onRetranslate,
  onDeleteTranslation,
  onRegenerate,
  onDelete,
  onSwitchSibling,
  quickRollbackEnabled,
  onQuickRollback,
}: StoryMessageItemProps) {
  // Хук вызываем до ранних return (правила хуков); для continue он просто простаивает.
  const { displayText, showTranslation, translating, toggle } = useTranslatable(
    message,
    targetLang,
    autoShowTranslation,
    onTranslate,
  );
  // Модалка — фоллбэк там, где нативный попап Telegram недоступен (ПК-клиенты, дев-браузер).
  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  // Пендинг регенерации/удаления перевода из меню долгого нажатия — отдельно от translating
  // (тот только для первого перевода по тапу), чтобы кнопка Globe крутила спиннер и на этих действиях.
  const [translateActionPending, setTranslateActionPending] = useState(false);
  // Пендинг быстрого отката — крутим спиннер на кнопке History, пока курсор истории переносится.
  const [rollbackPending, setRollbackPending] = useState(false);
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
  const hasCachedTranslation = Boolean(message.translations?.[targetLang]);

  const handleRegenerateTranslation = async () => {
    setTranslateActionPending(true);
    try {
      await onRetranslate(message.id, targetLang);
    } finally {
      setTranslateActionPending(false);
    }
  };

  const handleDeleteTranslationAction = async () => {
    setTranslateActionPending(true);
    try {
      await onDeleteTranslation(message.id, targetLang);
    } finally {
      setTranslateActionPending(false);
    }
  };

  const handleQuickRollback = async () => {
    setRollbackPending(true);
    try {
      await onQuickRollback(message.id);
    } finally {
      setRollbackPending(false);
    }
  };

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
          maxWidth: "85%",
        }}
      >
        <Clapperboard size={14} style={{ flexShrink: 0 }} />
        <Caption level="1">{displayText}</Caption>
        {showTranslateButton && (
          <>
            <button
              type="button"
              disabled={translating || translateActionPending || autoTranslating}
              onClick={toggle}
              className="story-translate-btn story-translate-btn--directive"
              style={{ ...iconBtn, color: showTranslation ? "var(--tgui--link_color)" : "inherit" }}
              aria-label="Перевести директиву"
              {...(hasCachedTranslation ? longPress : {})}
            >
              {translating || translateActionPending || autoTranslating ? <Spinner size="s" /> : <Globe size={14} />}
            </button>
            <TranslateActionModal
              open={translateModalOpen}
              onOpenChange={setTranslateModalOpen}
              onRegenerate={handleRegenerateTranslation}
              onDelete={handleDeleteTranslationAction}
            />
          </>
        )}
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
  // Быстрый откат — на всех битах, кроме последнего (на нём мы уже и так стоим).
  const showQuickRollback = quickRollbackEnabled && !isLast;

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
        <RpText text={displayText} />
      </div>

      {(showTranslateButton || showActions || showQuickRollback) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, color: "var(--tgui--hint_color)" }}>
          {showTranslateButton && (
            <>
              <button
                type="button"
                disabled={translating || translateActionPending || autoTranslating}
                onClick={toggle}
                className="story-translate-btn story-translate-btn--beat"
                style={{ ...iconBtn, color: showTranslation ? "var(--tgui--link_color)" : "inherit" }}
                aria-label="Перевести бит"
                {...(hasCachedTranslation ? longPress : {})}
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
          {showQuickRollback && (
            <button
              type="button"
              disabled={disabled || rollbackPending}
              onClick={handleQuickRollback}
              className="story-quick-rollback-btn"
              style={iconBtn}
              aria-label="Откатиться к этому сообщению"
            >
              {rollbackPending ? <Spinner size="s" /> : <History size={16} />}
            </button>
          )}
          {canSwitch && showActions && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                disabled={disabled || prevSibling === undefined}
                onClick={() => prevSibling !== undefined && onSwitchSibling(prevSibling)}
                style={iconBtn}
                aria-label="Предыдущий вариант"
              >
                <ChevronLeft size={16} />
              </button>
              <Caption level="1" Component="span">
                {message.siblingIndex + 1}/{message.siblingCount}
              </Caption>
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
          {showActions && (
            <>
              <button type="button" disabled={disabled} onClick={onRegenerate} style={iconBtn} aria-label="Перегенерировать">
                <RefreshCw size={16} />
              </button>
              <button type="button" disabled={disabled} onClick={onDelete} style={iconBtn} aria-label="Удалить">
                <Trash2 size={16} />
              </button>
            </>
          )}
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
  flexShrink: 0,
};
