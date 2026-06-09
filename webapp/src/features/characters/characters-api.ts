import { apiFetch } from "../../shared/api/client";
import type { Character, CharacterInput, CharacterListItem } from "./types";

/** Обёртки над apiFetch для CRUD персонажей. Граница webapp → /api/characters. */

export function listCharacters(): Promise<{ characters: CharacterListItem[] }> {
  return apiFetch<{ characters: CharacterListItem[] }>("/characters");
}

export function getCharacter(id: number): Promise<{ character: Character }> {
  return apiFetch<{ character: Character }>(`/characters/${id}`);
}

export function createCharacter(input: CharacterInput): Promise<{ character: Character }> {
  return apiFetch<{ character: Character }>("/characters", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCharacter(
  id: number,
  input: CharacterInput,
): Promise<{ character: Character }> {
  return apiFetch<{ character: Character }>(`/characters/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removeCharacter(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/characters/${id}`, { method: "DELETE" });
}
