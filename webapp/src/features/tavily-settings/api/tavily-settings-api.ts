import { apiFetch } from "../../../shared/api/client";
import type { TavilySettingsPatch, TavilySettingsStatus, VerifyTavilyKeyResult } from "../types/tavilySettings";

/** Статус ключа (без самого ключа). */
export function getTavilySettings(): Promise<TavilySettingsStatus> {
  return apiFetch<TavilySettingsStatus>("/settings/tavily");
}

/**
 * Проверяет ключ и заодно возвращает квоту (у Tavily нет отдельного эндпоинта верификации).
 * apiKey — ключ из поля ввода, ещё не сохранён; без аргумента — реверификация уже сохранённого
 * (сервер расшифрует сам).
 */
export function verifyTavilyKey(apiKey?: string): Promise<VerifyTavilyKeyResult> {
  return apiFetch<VerifyTavilyKeyResult>("/settings/tavily/verify", {
    method: "POST",
    body: JSON.stringify(apiKey ? { apiKey } : {}),
  });
}

export function saveTavilySettings(patch: TavilySettingsPatch): Promise<TavilySettingsStatus> {
  return apiFetch<TavilySettingsStatus>("/settings/tavily", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
