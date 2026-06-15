import { Spinner } from "@telegram-apps/telegram-ui";
import { Globe, Trash2 } from "lucide-react";
import { useState } from "react";
import { confirmAction } from "../../../shared/telegram/confirm";
import { translateText } from "../api/index";
import { RpText } from "./RpText";

interface ImpersonateVariantCardProps {
  chatId: number;
  /** Текст варианта (оригинал — именно он попадёт в поле ввода при тапе). */
  text: string;
  /** Язык перевода из настроек чата. */
  targetLang: string;
  onPick: (text: string) => void;
  onDelete: () => void;
}

/** Карточка варианта реплики: текст + кнопки перевода/удаления; тап по телу → подстановка в поле ввода. */
export function ImpersonateVariantCard({ chatId, text, targetLang, onPick, onDelete }: ImpersonateVariantCardProps) {
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // не подставлять вариант при клике по кнопке удаления
    const ok = await confirmAction("Удалить вариант?", {
      title: "Удаление варианта",
      confirmText: "Удалить",
    });
    if (ok) onDelete();
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
          {translating ? <Spinner size="s" /> : <Globe size={20} />}
        </button>
        <button
          className="impersonate-card__btn impersonate-card__btn--danger"
          onClick={handleDelete}
          type="button"
          aria-label="Удалить"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
}
