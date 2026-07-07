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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatId]);

  const update = useCallback(
    async (patch: Partial<ChatSettings>) => {
      const optimistic = { ...settings, ...patch };
      setSettings(optimistic);
      try {
        const updated = await updateChatSettings(chatId, patch);
        setSettings(updated);
      } catch {
        setSettings(settings);
      }
    },
    [chatId, settings],
  );

  return { settings, loading, update };
}
