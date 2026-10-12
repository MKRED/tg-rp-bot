import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "../../../shared/toast";
import { deleteStoryTranslation, translateStoryMessage } from "../api/stories-api";
import { storyTranslateFlags, withStoryTranslation } from "../lib/storyMessages";
import type { StoryMessage, StorySettings } from "../types/story";

/**
 * Переводы битов и директив: по кнопке, «перевести заново» и удаление перевода (меню долгого нажатия),
 * автоперевод новых сообщений по autoTranslateScope. Переводы кладутся в ленту (setMessages).
 */
export function useStoryTranslation(
  storyId: number,
  messages: StoryMessage[],
  setMessages: Dispatch<SetStateAction<StoryMessage[]>>,
  settings: StorySettings,
  /** История загружена — её сообщения на этот момент считаются показанными (их не автопереводим). */
  loaded: boolean,
) {
  const { showToast } = useToast();
  // Сообщения, которые уже были на экране, — автопереводим только новые. null — история ещё не загружена.
  const seenIds = useRef<Set<number> | null>(null);
  // Смена ветки или откат: сообщения ветки исторические, автоперевод для них не нужен.
  const suppressNext = useRef(false);
  // Автоперевод в полёте — кнопка перевода на этих сообщениях крутит спиннер.
  const [autoTranslatingIds, setAutoTranslatingIds] = useState<Set<number>>(new Set());

  const translate = useCallback(
    async (messageId: number, lang: string): Promise<string> => {
      try {
        const text = await translateStoryMessage(storyId, messageId, lang);
        setMessages((prev) => withStoryTranslation(prev, messageId, lang, text));
        return text;
      } catch (err) {
        // Пробрасываем дальше: useTranslatable не должен показать перевод, которого нет.
        console.error("Failed to translate story message", err);
        showToast({ type: "error", message: err instanceof Error ? err.message : "Не удалось перевести" });
        throw err;
      }
    },
    [storyId, setMessages, showToast],
  );

  // Перевод заново, мимо кэша.
  const retranslate = useCallback(
    async (messageId: number, lang: string) => {
      try {
        const text = await translateStoryMessage(storyId, messageId, lang, { force: true });
        setMessages((prev) => withStoryTranslation(prev, messageId, lang, text));
      } catch (err) {
        console.error("Failed to retranslate story message", err);
        showToast({ type: "error", message: err instanceof Error ? err.message : "Не удалось перевести" });
      }
    },
    [storyId, setMessages, showToast],
  );

  const removeTranslation = useCallback(
    async (messageId: number, lang: string) => {
      try {
        await deleteStoryTranslation(storyId, messageId, lang);
        setMessages((prev) => withStoryTranslation(prev, messageId, lang, null));
      } catch (err) {
        console.error("Failed to delete story translation", err);
        showToast({ type: "error", message: "Не удалось удалить перевод" });
      }
    },
    [storyId, setMessages, showToast],
  );

  // Автоперевод новых сообщений.
  useEffect(() => {
    if (!loaded) return;
    const ids = new Set(messages.map((m) => m.id));
    // Первая загрузка — всё помечаем увиденным без перевода. По флагу загрузки, а не по пустоте набора:
    // у пустой истории первый же ход иначе сошёл бы за «первую загрузку» и остался без автоперевода.
    const seen = seenIds.current;
    if (seen === null) {
      seenIds.current = ids;
      return;
    }
    const fresh = messages.filter((m) => !seen.has(m.id));
    seenIds.current = ids;
    // Смена ветки: её сообщения исторические. Флаг гасим только на прогоне, где новые сообщения
    // действительно пришли, — эффект перезапускают и перевод (setMessages), и смена настроек.
    if (fresh.length > 0 && suppressNext.current) {
      suppressNext.current = false;
      return;
    }

    const lang = settings.translateTargetLang;
    for (const msg of fresh) {
      if (!storyTranslateFlags(settings, msg).autoShow || msg.translations?.[lang]) continue;
      setAutoTranslatingIds((prev) => new Set(prev).add(msg.id));
      translate(msg.id, lang)
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
  }, [loaded, messages, settings, translate]);

  /** Вызвать перед сменой ветки или откатом: сообщения ветки не автопереводим. */
  const suppressAutoTranslate = useCallback(() => {
    suppressNext.current = true;
  }, []);

  return { translate, retranslate, removeTranslation, autoTranslatingIds, suppressAutoTranslate };
}
