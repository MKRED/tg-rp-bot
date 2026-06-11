import { apiFetch } from "../../../shared/api/client";
import { invalidateImage } from "../lib/imageCache";
import type { Persona, PersonaInput, PersonaListItem } from "../types/persona";

export function listPersonas(): Promise<{ personas: PersonaListItem[] }> {
  return apiFetch<{ personas: PersonaListItem[] }>("/personas");
}

export function getPersona(id: number): Promise<{ persona: Persona }> {
  return apiFetch<{ persona: Persona }>(`/personas/${id}`);
}

export function createPersona(input: PersonaInput): Promise<{ persona: Persona }> {
  return apiFetch<{ persona: Persona }>("/personas", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePersona(id: number, input: PersonaInput): Promise<{ persona: Persona }> {
  const res = await apiFetch<{ persona: Persona }>(`/personas/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  // Аватар мог смениться или быть удалён — кэш устарел
  invalidateImage(id);
  return res;
}

export async function removePersona(id: number): Promise<{ ok: true }> {
  const res = await apiFetch<{ ok: true }>(`/personas/${id}`, { method: "DELETE" });
  invalidateImage(id);
  return res;
}
