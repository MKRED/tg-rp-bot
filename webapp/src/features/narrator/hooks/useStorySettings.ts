import { useCallback, useEffect, useState } from "react";
import { getStorySettings, updateStorySettings } from "../api/settings-api";
import type { StorySettings } from "../types/story";

const DEFAULT_SETTINGS: StorySettings = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
  autoTranslateScope: "none",
  compactEnabled: false,
  compactAutoEnabled: false,
  compactFloorTokens: 0,
  compactWords: 200,
};

/** Загружает настройки перевода истории; update — оптимистичный PUT с откатом при ошибке. */
export function useStorySettings(storyId: number) {
  const [settings, setSettings] = useState<StorySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStorySettings(storyId)
      .then(setSettings)
      // Ошибку логируем (пустой catch запрещён конвенцией); UI остаётся на дефолтных настройках.
      .catch((err) => console.error("Failed to load story settings", err))
      .finally(() => setLoading(false));
  }, [storyId]);

  const update = useCallback(
    async (patch: Partial<StorySettings>) => {
      const optimistic = { ...settings, ...patch };
      setSettings(optimistic);
      try {
        const updated = await updateStorySettings(storyId, patch);
        setSettings(updated);
      } catch (err) {
        console.error("Failed to update story settings", err);
        setSettings(settings); // откатываем оптимистичное изменение
      }
    },
    [storyId, settings],
  );

  return { settings, loading, update };
}
