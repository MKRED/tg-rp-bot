import { useCallback, useEffect, useRef, useState } from "react";
import { getChatSettings, updateChatSettings } from "../api/settings-api";
import type { ChatSettings } from "../types/chat";

const DEFAULT_SETTINGS: ChatSettings = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
  autoTranslateScope: "none",
  translateMethod: "google",
};

export function useChatSettings(chatId: number) {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  // Актуальные настройки для update: правки идут подряд, пока предыдущий запрос ещё в полёте.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    setLoading(true);
    getChatSettings(chatId)
      .then(setSettings)
      // Остаёмся на настройках по умолчанию — чат работает и без них (перевод выключен).
      .catch((err) => console.error("Failed to load chat settings", err))
      .finally(() => setLoading(false));
  }, [chatId]);

  // Оптимистично применяет patch; при ошибке откатывает и возвращает false — экран покажет тост.
  const update = useCallback(
    async (patch: Partial<ChatSettings>): Promise<boolean> => {
      const keys = Object.keys(patch) as (keyof ChatSettings)[];
      // Значения до правки — для отката; из ref, а не из замыкания: замыкание могло устареть.
      const before = Object.fromEntries(keys.map((k) => [k, settingsRef.current[k]])) as Partial<ChatSettings>;
      // Сразу и в ref — следующая правка до перерисовки должна видеть эту.
      settingsRef.current = { ...settingsRef.current, ...patch };
      setSettings((cur) => ({ ...cur, ...patch }));
      try {
        const updated = await updateChatSettings(chatId, patch);
        // Из ответа берём только поля этого patch: другие правки, отправленные пока шёл запрос, не затираем.
        setSettings((cur) => ({ ...cur, ...Object.fromEntries(keys.map((k) => [k, updated[k]])) }));
        return true;
      } catch (err) {
        console.error("Failed to update chat settings", err);
        setSettings((cur) => ({ ...cur, ...before }));
        return false;
      }
    },
    [chatId],
  );

  return { settings, loading, update };
}
