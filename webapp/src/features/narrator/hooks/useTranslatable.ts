import { useEffect, useState } from "react";
import type { StoryMessage } from "../types/story";

/**
 * Тоггл перевода одного сообщения истории (бита/директивы): держит флаг показа и статус загрузки,
 * при первом показе запрашивает перевод, если его нет в кэше. Зеркало логики MessageBubble (RP).
 * После onTranslate перевод доезжает в message.translations (родитель обновляет ленту) — отсюда
 * displayText читает кэш и подменяет исходный текст.
 */
export function useTranslatable(
  message: StoryMessage,
  targetLang: string,
  autoShow: boolean,
  onTranslate: (messageId: number, targetLang: string) => Promise<string>,
) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Авто-перевод доставил перевод в translations — показываем автоматически.
  useEffect(() => {
    if (autoShow && message.translations?.[targetLang]) setShowTranslation(true);
  }, [message.translations, targetLang, autoShow]);

  // Перевод удалили (меню долгого нажатия на Globe) — прячем показанный перевод вместе с кэшем.
  useEffect(() => {
    if (!message.translations?.[targetLang]) setShowTranslation(false);
  }, [message.translations, targetLang]);

  const cached = message.translations?.[targetLang];
  const displayText = showTranslation && cached ? cached : message.content;

  const toggle = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (cached) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      await onTranslate(message.id, targetLang);
      setShowTranslation(true);
    } finally {
      setTranslating(false);
    }
  };

  return { displayText, showTranslation, translating, toggle };
}
