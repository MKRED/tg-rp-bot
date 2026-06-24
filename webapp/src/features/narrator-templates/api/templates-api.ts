import { apiFetch } from "../../../shared/api/client";
import type {
  NarratorTemplate,
  NarratorTemplateInput,
  NarratorTemplateListItem,
} from "../types/template";

/** Обёртки над apiFetch для CRUD narrator-шаблонов. Граница webapp → /api/narrator-templates. */

export function listTemplates(): Promise<{ templates: NarratorTemplateListItem[] }> {
  return apiFetch<{ templates: NarratorTemplateListItem[] }>("/narrator-templates");
}

export function getTemplate(id: number): Promise<{ template: NarratorTemplate }> {
  return apiFetch<{ template: NarratorTemplate }>(`/narrator-templates/${id}`);
}

export function createTemplate(input: NarratorTemplateInput): Promise<{ template: NarratorTemplate }> {
  return apiFetch<{ template: NarratorTemplate }>("/narrator-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTemplate(
  id: number,
  input: NarratorTemplateInput,
): Promise<{ template: NarratorTemplate }> {
  return apiFetch<{ template: NarratorTemplate }>(`/narrator-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removeTemplate(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/narrator-templates/${id}`, { method: "DELETE" });
}
