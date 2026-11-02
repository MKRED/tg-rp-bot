import { apiFetch } from "../../../shared/api/client";
import type { CardTemplate, CardTemplateInput } from "../types/cardTemplate";

/** Список отдаёт шаблоны целиком — пикеру в карточке не нужен второй запрос. */
export function listCardTemplates(): Promise<{ templates: CardTemplate[] }> {
  return apiFetch<{ templates: CardTemplate[] }>("/card-templates");
}

export function getCardTemplate(id: number): Promise<{ template: CardTemplate }> {
  return apiFetch<{ template: CardTemplate }>(`/card-templates/${id}`);
}

export function createCardTemplate(input: CardTemplateInput): Promise<{ template: CardTemplate }> {
  return apiFetch<{ template: CardTemplate }>("/card-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCardTemplate(id: number, input: CardTemplateInput): Promise<{ template: CardTemplate }> {
  return apiFetch<{ template: CardTemplate }>(`/card-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removeCardTemplate(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/card-templates/${id}`, { method: "DELETE" });
}
