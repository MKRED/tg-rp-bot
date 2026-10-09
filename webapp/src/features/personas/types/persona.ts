// Контракт списка/формы и лимит — общие с сервером, живут в пакете @tg-rp-bot/shared.
export type { PersonaInput, PersonaListItem } from "@tg-rp-bot/shared";
export { MAX_PERSONAS_PER_USER } from "@tg-rp-bot/shared";

/** Полная персона из GET /api/personas/:id */
export interface Persona {
  id: number;
  name: string;
  image: string | null;
  imageFull: string | null;
  footnote: string | null;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}
