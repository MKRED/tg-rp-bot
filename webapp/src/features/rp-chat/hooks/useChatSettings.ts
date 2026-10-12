import { useCallback, useEffect, useState } from "react";
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
      const optimistic = { ...settings, ...patch };
      setSettings(optimistic);
      try {
        const updated = await updateChatSettings(chatId, patch);
        setSettings(updated);
        return true;
      } catch (err) {
        console.error("Failed to update chat settings", err);
        // Откатываем только поля этого patch: другие правки, сделанные пока запрос шёл, не трогаем.
        const revert = Object.fromEntries(Object.keys(patch).map((k) => [k, settings[k as keyof ChatSettings]]));
        setSettings((cur) => ({ ...cur, ...revert }));
        return false;
      }
    },
    [chatId, settings],
  );

  return { settings, loading, update };
}
