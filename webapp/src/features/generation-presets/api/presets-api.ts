import { apiFetch } from "../../../shared/api/client";
import type { Preset, PresetInput, PresetListItem } from "../types/preset";

/** Обёртки над apiFetch для CRUD пресетов. Граница webapp → /api/presets. */

export function listPresets(): Promise<{ presets: PresetListItem[] }> {
  return apiFetch<{ presets: PresetListItem[] }>("/presets");
}

export function getPreset(id: number): Promise<{ preset: Preset }> {
  return apiFetch<{ preset: Preset }>(`/presets/${id}`);
}

export function createPreset(input: PresetInput): Promise<{ preset: Preset }> {
  return apiFetch<{ preset: Preset }>("/presets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePreset(id: number, input: PresetInput): Promise<{ preset: Preset }> {
  return apiFetch<{ preset: Preset }>(`/presets/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removePreset(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/presets/${id}`, { method: "DELETE" });
}
