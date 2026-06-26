import { apiFetch } from "../../../shared/api/client";
import type { LlmDebugRecord, LlmDebugSettings } from "../types/debug";

/** Настройки перехвата + накопленные записи запросов пользователя. */
export async function getLlmDebug(): Promise<{
  settings: LlmDebugSettings;
  records: LlmDebugRecord[];
}> {
  return apiFetch<{ settings: LlmDebugSettings; records: LlmDebugRecord[] }>("/debug/llm");
}

/** Изменить настройки перехвата (частичный patch). */
export async function updateLlmDebugSettings(
  patch: Partial<LlmDebugSettings>,
): Promise<LlmDebugSettings> {
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
