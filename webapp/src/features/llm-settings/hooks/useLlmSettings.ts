import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../shared/toast";
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
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

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
  // Возвращает исход вызывающему коду (verifyAndSave), т.к. state-сеттеры асинхронны и читать
  // selectedModel сразу после setSelectedModel в том же тике нельзя — вернём выбранную модель явно.
  // silent — без тоста об успехе: раскрытие DeepSeekModelPicker дёргает verify() на каждый показ
  // меню (см. onOpen в LlmSettingsSection), и тост при обычном пролистывании моделей был бы спамом;
  // ошибку показываем в любом случае — она значима независимо от того, кто вызвал verify().
  const verify = useCallback(async (opts?: { silent?: boolean }): Promise<
    { ok: true; model: string | null } | { ok: false }
  > => {
    setVerifying(true);
    try {
      const res = await verifyDeepSeekKey(keyInput.trim() || undefined);
      if (!res.ok) {
        setModels(null);
        showToast({
          type: "error",
          message: VERIFY_ERROR_MESSAGES[res.error ?? ""] ?? "Не удалось проверить ключ.",
        });
        return { ok: false };
      }
      setModels(res.models ?? []);
      // Сохраняем текущий выбор, если он есть в списке; иначе — первая доступная модель.
      const nextModel = selectedModel && res.models?.includes(selectedModel)
        ? selectedModel
        : (res.models?.[0] ?? null);
      setSelectedModel(nextModel);
      if (!opts?.silent) {
        showToast({ type: "success", message: `Ключ действителен, доступно моделей: ${res.models?.length ?? 0}` });
      }
      return { ok: true, model: nextModel };
    } catch (err) {
      console.error("Failed to verify DeepSeek key", err);
      showToast({ type: "error", message: "Не удалось проверить ключ. Попробуйте ещё раз." });
      return { ok: false };
    } finally {
      setVerifying(false);
    }
  }, [keyInput, selectedModel, showToast]);

  // modelOverride нужен verifyAndSave: свежерезолвленная verify() модель ещё не осела в state.
  const save = useCallback(async (modelOverride?: string | null) => {
    setSaving(true);
    try {
      const trimmed = keyInput.trim();
      const modelToSave = modelOverride !== undefined ? modelOverride : selectedModel;
      const res = await saveLlmSettings({
        ...(trimmed && { apiKey: trimmed }),
        ...(modelToSave && { model: modelToSave }),
      });
      setStatus(res);
      setKeyInput("");
    } catch (err) {
      console.error("Failed to save LLM settings", err);
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "Не удалось сохранить настройки.",
      });
    } finally {
      setSaving(false);
    }
  }, [keyInput, selectedModel, showToast]);

  // Комбо для кнопки в after поля ввода: проверить новый ключ и сразу сохранить с резолвленной моделью.
  const verifyAndSave = useCallback(async () => {
    const result = await verify();
    if (result.ok) await save(result.model);
  }, [verify, save]);

  const clearKey = useCallback(async () => {
    setSaving(true);
    try {
      setStatus(await saveLlmSettings({ apiKey: null }));
      setKeyInput("");
      setModels(null);
      setSelectedModel(null);
    } catch (err) {
      console.error("Failed to clear DeepSeek key", err);
      showToast({ type: "error", message: "Не удалось удалить ключ." });
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  return {
    status,
    loading,
    keyInput,
    setKeyInput,
    models,
    selectedModel,
    setSelectedModel,
    verifying,
    verify,
    verifyAndSave,
    saving,
    save,
    clearKey,
  };
}
