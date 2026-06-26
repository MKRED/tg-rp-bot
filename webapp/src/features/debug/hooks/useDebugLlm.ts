import { useCallback, useEffect, useState } from "react";
import {
  clearLlmDebugRecords,
  getLlmDebug,
  updateLlmDebugSettings,
} from "../api/debug-api";
import type { LlmDebugRecord, LlmDebugSettings } from "../types/debug";

const DEFAULT_SETTINGS: LlmDebugSettings = { enabled: true, maxRequests: 30 };

/**
 * Состояние экрана отладки LLM: настройки перехвата (тумблер + N, с сервера) и записи запросов.
 * headK/tailK — чисто клиентские (сколько сообщений показывать с краёв), переживают перезагрузку
 * через localStorage; на сервер не уходят (усечение применяется на показе).
 */
export function useDebugLlm() {
  const [settings, setSettings] = useState<LlmDebugSettings>(DEFAULT_SETTINGS);
  const [records, setRecords] = useState<LlmDebugRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [headK, setHeadK] = useState(() => readK("llmDebugHeadK", 3));
  const [tailK, setTailK] = useState(() => readK("llmDebugTailK", 5));

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

  // Сохраняем K в localStorage при каждом изменении (переживёт перезагрузку Mini App).
  useEffect(() => localStorage.setItem("llmDebugHeadK", String(headK)), [headK]);
  useEffect(() => localStorage.setItem("llmDebugTailK", String(tailK)), [tailK]);

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

  return {
    settings,
    records,
    loading,
    headK,
    tailK,
    setHeadK,
    setTailK,
    refresh,
    updateSettings,
    clear,
  };
}

/** Прочитать число из localStorage с фолбэком (для headK/tailK). */
function readK(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
