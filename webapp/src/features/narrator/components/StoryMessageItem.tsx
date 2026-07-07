import { Spinner } from "@telegram-apps/telegram-ui";
import { ChevronLeft, ChevronRight, Clapperboard, Globe, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { RpText } from "../../../shared/components/RpText";
import { TranslateActionMenu } from "../../../shared/components/TranslateActionMenu";
import { useLongPress } from "../../../shared/hooks/useLongPress";
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
  onTranslate: (messageId: number, targetLang: string) => Promise<string>;
  /** Пересчитывает перевод заново (игнорируя кэш) — из меню долгого нажатия на Globe. */
  onRetranslate: (messageId: number, targetLang: string) => void;
  /** Удаляет закэшированный перевод — из меню долгого нажатия на Globe. */
  onDeleteTranslation: (messageId: number, targetLang: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onSwitchSibling: (siblingId: number) => void;
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
  onTranslate,
  onRetranslate,
  onDeleteTranslation,
  onRegenerate,
  onDelete,
  onSwitchSibling,
}: StoryMessageItemProps) {
  // Хук вызываем до ранних return (правила хуков); для continue он просто простаивает.
  const { displayText, showTranslation, translating, toggle } = useTranslatable(
    message,
    targetLang,
    autoShowTranslation,
    onTranslate,
  );
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  const longPress = useLongPress(() => setTranslateMenuOpen(true));
  const hasCachedTranslation = Boolean(message.translations?.[targetLang]);

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
        <Clapperboard size={14} style={{ flexShrink: 0 }} />
        <span>{displayText}</span>
        {showTranslateButton && (
          <span style={{ position: "relative" }}>
            <button
              type="button"
              disabled={translating}
              onClick={toggle}
              style={{ ...iconBtn, color: showTranslation ? "var(--tgui--link_color)" : "inherit" }}
              aria-label="Перевести директиву"
              {...(hasCachedTranslation ? longPress : {})}
            >
              {translating ? <Spinner size="s" /> : <Globe size={14} />}
            </button>
            {translateMenuOpen && (
              <TranslateActionMenu
                onRegenerate={() => onRetranslate(message.id, targetLang)}
                onDelete={() => onDeleteTranslation(message.id, targetLang)}
                onClose={() => setTranslateMenuOpen(false)}
              />
            )}
          </span>
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

      {(showTranslateButton || showActions) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, color: "var(--tgui--hint_color)" }}>
          {showTranslateButton && (
            <span style={{ position: "relative" }}>
              <button
                type="button"
                disabled={translating}
                onClick={toggle}
                style={{ ...iconBtn, color: showTranslation ? "var(--tgui--link_color)" : "inherit" }}
                aria-label="Перевести бит"
                {...(hasCachedTranslation ? longPress : {})}
              >
                {translating ? <Spinner size="s" /> : <Globe size={16} />}
              </button>
              {translateMenuOpen && (
                <TranslateActionMenu
                  onRegenerate={() => onRetranslate(message.id, targetLang)}
                  onDelete={() => onDeleteTranslation(message.id, targetLang)}
                  onClose={() => setTranslateMenuOpen(false)}
                />
              )}
            </span>
          )}
          {canSwitch && showActions && (
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
