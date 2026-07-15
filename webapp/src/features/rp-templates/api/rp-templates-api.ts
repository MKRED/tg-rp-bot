import { apiFetch } from "../../../shared/api/client";
import type { RpTemplate, RpTemplateInput, RpTemplateListItem } from "../types/template";

/** Обёртки над apiFetch для CRUD RP-шаблонов. Граница webapp → /api/rp-templates. */

export function listRpTemplates(): Promise<{ templates: RpTemplateListItem[] }> {
  return apiFetch<{ templates: RpTemplateListItem[] }>("/rp-templates");
}

export function getRpTemplate(id: number): Promise<{ template: RpTemplate }> {
  return apiFetch<{ template: RpTemplate }>(`/rp-templates/${id}`);
}

export function createRpTemplate(input: RpTemplateInput): Promise<{ template: RpTemplate }> {
  return apiFetch<{ template: RpTemplate }>("/rp-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRpTemplate(
  id: number,
  input: RpTemplateInput,
): Promise<{ template: RpTemplate }> {
  return apiFetch<{ template: RpTemplate }>(`/rp-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removeRpTemplate(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/rp-templates/${id}`, { method: "DELETE" });
}
