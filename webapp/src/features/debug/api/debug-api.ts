import { apiFetch } from "../../../shared/api/client";
import type { LlmDebugSettings, LlmDebugSettingsPatch, LlmDebugView } from "../types/debug";

/** Настройки перехвата + накопленные записи запросов пользователя. */
export async function getLlmDebug(): Promise<LlmDebugView> {
  return apiFetch<LlmDebugView>("/debug/llm");
}

/** Изменить настройки перехвата (частичный patch). */
export async function updateLlmDebugSettings(patch: LlmDebugSettingsPatch): Promise<LlmDebugSettings> {
  const res = await apiFetch<{ settings: LlmDebugSettings }>("/debug/llm/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return res.settings;
}

/** Очистить накопленные записи пользователя. */
export async function clearLlmDebugRecords(): Promise<void> {
  await apiFetch<{ ok: true }>("/debug/llm/records", { method: "DELETE" });
}
