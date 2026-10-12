import { useCallback, useEffect, useRef, useState } from "react";
import { getStorySettings, updateStorySettings } from "../api/settings-api";
import type { StorySettings } from "../types/story";

const DEFAULT_SETTINGS: StorySettings = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
  autoTranslateScope: "none",
  translateMethod: "google",
  compactEnabled: false,
  compactAutoEnabled: false,
  compactFloorTokens: 0,
  compactWords: 200,
  quickRollbackEnabled: false,
  editEnabled: false,
};

/** Загружает настройки истории; update — оптимистичный PUT с откатом при ошибке. */
export function useStorySettings(storyId: number) {
  const [settings, setSettings] = useState<StorySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  // Актуальные настройки для update: правки идут подряд, пока предыдущий запрос ещё в полёте.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    setLoading(true);
    getStorySettings(storyId)
      .then(setSettings)
      // Ошибку логируем (пустой catch запрещён конвенцией); UI остаётся на дефолтных настройках.
      .catch((err) => console.error("Failed to load story settings", err))
      .finally(() => setLoading(false));
  }, [storyId]);

  // Оптимистично применяет patch; при ошибке откатывает и возвращает false — экран покажет тост.
  const update = useCallback(
    async (patch: Partial<StorySettings>): Promise<boolean> => {
      const keys = Object.keys(patch) as (keyof StorySettings)[];
      // Значения до правки — для отката; из ref, а не из замыкания: замыкание могло устареть.
      const before = Object.fromEntries(keys.map((k) => [k, settingsRef.current[k]])) as Partial<StorySettings>;
      // Сразу и в ref — следующая правка до перерисовки должна видеть эту.
      settingsRef.current = { ...settingsRef.current, ...patch };
      setSettings((cur) => ({ ...cur, ...patch }));
      try {
        const updated = await updateStorySettings(storyId, patch);
        // Из ответа берём только поля этого patch: другие правки, отправленные пока шёл запрос, не затираем.
        setSettings((cur) => ({ ...cur, ...Object.fromEntries(keys.map((k) => [k, updated[k]])) }));
        return true;
      } catch (err) {
        console.error("Failed to update story settings", err);
        setSettings((cur) => ({ ...cur, ...before }));
        return false;
      }
    },
    [storyId],
  );

  return { settings, loading, update };
}
