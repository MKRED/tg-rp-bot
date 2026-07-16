import { apiFetch } from "../../../shared/api/client";
import { invalidateAvatar } from "../../../shared/avatar/avatarCache";
import { invalidateImage } from "../lib/imageCache";
import type { Character, CharacterInput, CharacterListItem } from "../types/character";

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

export async function updateCharacter(
  id: number,
  input: CharacterInput,
): Promise<{ character: Character }> {
  const res = await apiFetch<{ character: Character }>(`/characters/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  // Аватар мог смениться или быть удалён — кэш устарел (и его копия в стеках AvatarStack)
  invalidateImage(id);
  invalidateAvatar({ type: "character", id });
  return res;
}

export async function removeCharacter(id: number): Promise<{ ok: true }> {
  const res = await apiFetch<{ ok: true }>(`/characters/${id}`, { method: "DELETE" });
  invalidateImage(id);
  invalidateAvatar({ type: "character", id });
  return res;
}
