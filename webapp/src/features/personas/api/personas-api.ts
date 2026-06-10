import { apiFetch } from "../../../shared/api/client";
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

export function updatePersona(id: number, input: PersonaInput): Promise<{ persona: Persona }> {
  return apiFetch<{ persona: Persona }>(`/personas/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removePersona(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/personas/${id}`, { method: "DELETE" });
}
