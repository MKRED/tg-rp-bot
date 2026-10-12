import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "../../../shared/toast";
import { deleteTranslation, translateMessage } from "../api/messages-api";
import { withTranslation } from "../lib/translations";
import type { ChatDetail, ChatSettings } from "../types/chat";

/**
 * Переводы сообщений чата: по кнопке, «перевести заново» и удаление перевода (меню долгого нажатия),
 * автоперевод новых сообщений по настройке autoTranslateScope. Переводы кладутся в ленту (setChat).
 */
export function useChatTranslation(
  chatId: number,
  chat: ChatDetail | null,
  setChat: Dispatch<SetStateAction<ChatDetail | null>>,
  settings: ChatSettings,
) {
  const { showToast } = useToast();
  // Сообщения, которые уже были на экране, — автопереводим только новые.
  const seenIds = useRef<Set<number>>(new Set());
  // Смена ветки: сообщения новой ветки исторические, автоперевод для них не нужен.
  const suppressNext = useRef(false);
  // Автоперевод в полёте — кнопка перевода на этих сообщениях крутит спиннер.
  const [autoTranslatingIds, setAutoTranslatingIds] = useState<Set<number>>(new Set());

  const translate = useCallback(
    async (messageId: number, lang: string): Promise<string> => {
      try {
        const text = await translateMessage(chatId, messageId, lang);
        setChat((prev) => withTranslation(prev, messageId, lang, text));
        return text;
      } catch (err) {
        // Пробрасываем дальше: useTranslatable не должен показать перевод, которого нет.
        console.error("Failed to translate message", err);
        showToast({ type: "error", message: err instanceof Error ? err.message : "Не удалось перевести сообщение" });
        throw err;
      }
    },
    [chatId, setChat, showToast],
  );

  // Перевод заново, мимо кэша.
  const retranslate = useCallback(
    async (messageId: number, lang: string) => {
      try {
        const text = await translateMessage(chatId, messageId, lang, { force: true });
        setChat((prev) => withTranslation(prev, messageId, lang, text));
      } catch (err) {
        console.error("Failed to retranslate message", err);
        showToast({ type: "error", message: err instanceof Error ? err.message : "Не удалось перевести сообщение" });
      }
    },
    [chatId, setChat, showToast],
  );

  const removeTranslation = useCallback(
    async (messageId: number, lang: string) => {
      try {
        await deleteTranslation(chatId, messageId, lang);
        setChat((prev) => withTranslation(prev, messageId, lang, null));
      } catch (err) {
        console.error("Failed to delete translation", err);
        showToast({ type: "error", message: "Не удалось удалить перевод" });
      }
    },
    [chatId, setChat, showToast],
  );

  // Автоперевод новых сообщений.
  useEffect(() => {
    const msgs = chat?.messages;
    if (!msgs?.length) return;
    const ids = new Set(msgs.map((m) => m.id));

    // Первая загрузка или смена ветки — всё помечаем увиденным без перевода.
    if (seenIds.current.size === 0 || suppressNext.current) {
      suppressNext.current = false;
      seenIds.current = ids;
      return;
    }
    const fresh = msgs.filter((m) => !seenIds.current.has(m.id));
    seenIds.current = ids;

    const { autoTranslateScope, translateTargetLang, translateEnabled } = settings;
    if (!translateEnabled || autoTranslateScope === "none") return;

    for (const msg of fresh) {
      if (autoTranslateScope !== "all" && autoTranslateScope !== msg.role) continue;
      if (msg.translations?.[translateTargetLang]) continue;
      setAutoTranslatingIds((prev) => new Set(prev).add(msg.id));
      translate(msg.id, translateTargetLang)
        // translate уже показал тост и залогировал ошибку — здесь только отметка для отладки.
        .catch((err) => console.debug("Auto-translate failed", err))
        .finally(() =>
          setAutoTranslatingIds((prev) => {
            const next = new Set(prev);
            next.delete(msg.id);
            return next;
          }),
        );
    }
  }, [chat?.messages, settings, translate]);

  /** Вызвать перед сменой ветки: её сообщения не автопереводим. */
  const suppressAutoTranslate = useCallback(() => {
    suppressNext.current = true;
  }, []);

  return { translate, retranslate, removeTranslation, autoTranslatingIds, suppressAutoTranslate };
}
