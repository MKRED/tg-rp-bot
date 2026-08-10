import { apiFetch } from "../../../shared/api/client";
import type { TranslateSettings, TranslateSettingsPatch } from "../types/translateSettings";

/** Настройки режима перевода PromptEditorOverlay по умолчанию (движок, язык, свой ИИ-промпт). */
export function getTranslateSettings(): Promise<TranslateSettings> {
  return apiFetch<TranslateSettings>("/settings/translate");
}

export function saveTranslateSettings(patch: TranslateSettingsPatch): Promise<TranslateSettings> {
  return apiFetch<TranslateSettings>("/settings/translate", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
