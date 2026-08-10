import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../shared/toast";
import { getTranslateSettings, saveTranslateSettings } from "../api/translate-settings-api";
import type { TranslateSettings, TranslateSettingsPatch } from "../types/translateSettings";

const DEFAULTS: TranslateSettings = {
  engine: "google",
  targetLang: "en",
  promptTemplate: null,
  reasoningEffort: "off",
};

/**
 * Состояние секции «Перевод в редакторе» на экране настроек — дефолты для режима перевода в
 * PromptEditorOverlay (usePromptTranslate.ts сидируется этими значениями один раз при открытии
 * оверлея). Свой ИИ-промпт редактируется через PromptEditorField/-Overlay (как
 * translationSystemPrompt у RP-шаблонов) — сохраняется на «Готово» внутри оверлея, отдельного
 * черновика/кнопки сохранения на уровне секции не нужно.
 */
export function useTranslateSettings() {
  const [settings, setSettings] = useState<TranslateSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    getTranslateSettings()
      .then((res) => setSettings(res))
      .catch((err) => console.error("Failed to load translate settings", err))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(
    async (patch: TranslateSettingsPatch) => {
      setSaving(true);
      try {
        const res = await saveTranslateSettings(patch);
        setSettings(res);
      } catch (err) {
        console.error("Failed to save translate settings", err);
        showToast({ type: "error", message: "Не удалось сохранить настройки перевода." });
      } finally {
        setSaving(false);
      }
    },
    [showToast],
  );

  return {
    settings,
    loading,
    saving,
    setEngine: (engine: TranslateSettings["engine"]) => void save({ engine }),
    setTargetLang: (targetLang: string) => void save({ targetLang }),
    setPromptTemplate: (next: string) => void save({ promptTemplate: next.trim() || null }),
  };
}
