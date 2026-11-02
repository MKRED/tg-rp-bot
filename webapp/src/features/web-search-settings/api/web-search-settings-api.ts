import { apiFetch } from "../../../shared/api/client";
import type { WebSearchSettings, WebSearchSettingsPatch } from "../types/webSearchSettings";

export function getWebSearchSettings(): Promise<WebSearchSettings> {
  return apiFetch<WebSearchSettings>("/settings/web-search");
}

export function saveWebSearchSettings(patch: WebSearchSettingsPatch): Promise<WebSearchSettings> {
  return apiFetch<WebSearchSettings>("/settings/web-search", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
