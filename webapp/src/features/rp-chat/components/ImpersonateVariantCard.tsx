import { Spinner } from "@telegram-apps/telegram-ui";
import { Globe } from "lucide-react";
import { useState } from "react";
import { translateText } from "../api/index";
import { RpText } from "./RpText";

interface ImpersonateVariantCardProps {
  chatId: number;
  /** Текст варианта (оригинал — именно он попадёт в поле ввода при тапе). */
  text: string;
  /** Язык перевода из настроек чата. */
  targetLang: string;
  onPick: (text: string) => void;
}

/** Карточка варианта реплики: текст + кнопка перевода; тап по телу → подстановка в поле ввода. */
export function ImpersonateVariantCard({ chatId, text, targetLang, onPick }: ImpersonateVariantCardProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const display = showTranslation && translation ? translation : text;

  const handleTranslateToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // не подставлять вариант при клике по кнопке перевода
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translation) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const t = await translateText(chatId, text, targetLang);
      setTranslation(t);
      setShowTranslation(true);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="impersonate-card" onClick={() => onPick(text)}>
      <p className="impersonate-card__text"><RpText text={display} /></p>
      <div className="impersonate-card__actions">
        <button
          className={`impersonate-card__btn${showTranslation ? " impersonate-card__btn--active" : ""}`}
          onClick={handleTranslateToggle}
          disabled={translating}
          type="button"
          aria-label="Перевести"
        >
          {translating ? <Spinner size="s" /> : <Globe size={16} />}
        </button>
      </div>
    </div>
  );
}
