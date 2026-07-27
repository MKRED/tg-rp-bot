import { useCallback, useEffect, useState } from "react";
import { getLlmSettings, saveLlmSettings, verifyDeepSeekKey } from "../api/llm-settings-api";
import type { LlmSettingsStatus } from "../types/llmSettings";

const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  invalid_key: "Ключ не принят DeepSeek — проверьте, что он скопирован полностью и без опечаток.",
  no_key: "Сначала введите ключ.",
};

/**
 * Состояние экрана «ИИ (DeepSeek)»: статус ключа/модели приходит с сервера (одинаково на всех
 * устройствах), список моделей — эфемерный, заполняется только после «Проверить ключ» (сервер не
 * хранит список моделей — только выбранный id). Ключ в поле ввода никогда не префиллится значением
 * с сервера (сервер его и не возвращает) — только last4 в подписи.
 */
export function useLlmSettings() {
  const [status, setStatus] = useState<LlmSettingsStatus>({ hasKey: false, last4: null, model: null });
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [models, setModels] = useState<string[] | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    return getLlmSettings()
      .then((res) => {
        setStatus(res);
        setSelectedModel(res.model);
      })
      .catch((err) => console.error("Failed to load LLM settings", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Проверяет введённый ключ (или уже сохранённый, если поле пустое) и подтягивает список моделей.
  const verify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await verifyDeepSeekKey(keyInput.trim() || undefined);
      if (!res.ok) {
        setModels(null);
        setVerifyError(VERIFY_ERROR_MESSAGES[res.error ?? ""] ?? "Не удалось проверить ключ.");
        return;
      }
      setModels(res.models ?? []);
      // Сохраняем текущий выбор, если он есть в списке; иначе — первая доступная модель.
      setSelectedModel((prev) =>
        prev && res.models?.includes(prev) ? prev : (res.models?.[0] ?? null),
      );
    } catch (err) {
      console.error("Failed to verify DeepSeek key", err);
      setVerifyError("Не удалось проверить ключ. Попробуйте ещё раз.");
    } finally {
      setVerifying(false);
    }
  }, [keyInput]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const trimmed = keyInput.trim();
      const res = await saveLlmSettings({
        ...(trimmed && { apiKey: trimmed }),
        ...(selectedModel && { model: selectedModel }),
      });
      setStatus(res);
      setKeyInput("");
    } catch (err) {
      console.error("Failed to save LLM settings", err);
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить настройки.");
    } finally {
      setSaving(false);
    }
  }, [keyInput, selectedModel]);

  const clearKey = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      setStatus(await saveLlmSettings({ apiKey: null }));
      setKeyInput("");
      setModels(null);
      setSelectedModel(null);
    } catch (err) {
      console.error("Failed to clear DeepSeek key", err);
      setSaveError("Не удалось удалить ключ.");
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    status,
    loading,
    keyInput,
    setKeyInput,
    models,
    selectedModel,
    setSelectedModel,
    verifying,
    verifyError,
    verify,
    saving,
    saveError,
    save,
    clearKey,
  };
}
