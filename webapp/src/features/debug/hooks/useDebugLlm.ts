import { useCallback, useEffect, useState } from "react";
import {
  clearLlmDebugRecords,
  getLlmDebug,
  updateLlmDebugSettings,
} from "../api/debug-api";
import type { LlmDebugRecord, LlmDebugSettings } from "../types/debug";

const DEFAULT_SETTINGS: LlmDebugSettings = {
  enabled: true,
  maxRequests: 30,
  headMessages: 3,
  tailMessages: 5,
};

/**
 * Состояние экрана отладки LLM: все настройки (тумблер, N, сколько сообщений с краёв) приходят
 * с сервера и через него же сохраняются — поэтому одинаковы на всех устройствах пользователя.
 */
export function useDebugLlm() {
  const [settings, setSettings] = useState<LlmDebugSettings>(DEFAULT_SETTINGS);
  const [records, setRecords] = useState<LlmDebugRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return getLlmDebug()
      .then((res) => {
        setSettings(res.settings);
        setRecords(res.records);
      })
      .catch((err) => console.error("Failed to load LLM debug data", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Настройки сохраняем оптимистично: при ошибке откатываем к прежнему значению.
  const updateSettings = useCallback(
    async (patch: Partial<LlmDebugSettings>) => {
      const prev = settings;
      setSettings({ ...settings, ...patch });
      try {
        setSettings(await updateLlmDebugSettings(patch));
      } catch {
        setSettings(prev);
      }
    },
    [settings],
  );

  const clear = useCallback(async () => {
    try {
      await clearLlmDebugRecords();
      setRecords([]);
    } catch (err) {
      // Не очищаем список локально, если сервер не подтвердил — иначе UI разойдётся с сервером.
      console.error("Failed to clear LLM debug records", err);
    }
  }, []);

  return { settings, records, loading, refresh, updateSettings, clear };
}
