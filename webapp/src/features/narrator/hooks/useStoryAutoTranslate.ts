import { useCallback, useEffect, useRef } from "react";
import type { StorySettings, StoryMessage } from "../types/story";

/**
 * Авто-перевод новых битов/директив согласно autoTranslateScope (continue-ходы пропускаем).
 * Держит набор «уже виденных» id, чтобы переводить только появившиеся сообщения, и флаг подавления
 * для смены ветки (её сообщения исторические). Зеркало логики RpChatPage, вынесенное из страницы.
 */
export function useStoryAutoTranslate(
  messages: StoryMessage[],
  settings: StorySettings,
  translate: (msgId: number, lang: string) => Promise<string>,
) {
  const seenMessageIds = useRef<Set<number>>(new Set());
  const suppressNext = useRef(false);

  useEffect(() => {
    if (!messages.length) return;

    // Первая загрузка истории или смена ветки — помечаем всё как «видимое» без перевода.
    if (seenMessageIds.current.size === 0 || suppressNext.current) {
      suppressNext.current = false;
      seenMessageIds.current = new Set(messages.map((m) => m.id));
      return;
    }

    const { autoTranslateScope, translateTargetLang, translateEnabled } = settings;
    if (!translateEnabled || autoTranslateScope === "none") {
      seenMessageIds.current = new Set(messages.map((m) => m.id));
      return;
    }
    const newMsgs = messages.filter((m) => !seenMessageIds.current.has(m.id));
    seenMessageIds.current = new Set(messages.map((m) => m.id));
    for (const msg of newMsgs) {
      if (
        msg.kind !== "continue" &&
        (autoTranslateScope === "all" || autoTranslateScope === msg.role) &&
        !msg.translations?.[translateTargetLang]
      ) {
        translate(msg.id, translateTargetLang).catch(() => {});
      }
    }
  }, [messages, settings, translate]);

  /** Пометить следующий набор сообщений историческим (смена ветки) — не авто-переводить его. */
  const suppressNextRun = useCallback(() => {
    suppressNext.current = true;
  }, []);

  return { suppressNextRun };
}
