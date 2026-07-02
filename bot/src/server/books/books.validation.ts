import type { Character } from "../../db/schema.js";
import type { BookInput, EntryInput } from "../../db/knowledge/index.js";

/** Промпт/сценарий персонажа ссылается на {{user}} — карточка не знает, кто отыгрывает за пользователя. */
export function characterNeedsUserAlias(character: Pick<Character, "prompt" | "scenario">): boolean {
  return /\{\{user\}\}/i.test(character.prompt) || /\{\{user\}\}/i.test(character.scenario);
}

export function parseBookInput(body: unknown): { input: BookInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };
  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 2000) : null;
  return { input: { name: name.slice(0, 100), description } };
}

export function parseEntryInput(body: unknown): { input: EntryInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 100) : "";
  const enabled = b.enabled !== false;
  const activation = b.activation === "keyword" ? "keyword" : "always_on";
  const characterId = typeof b.characterId === "number" ? b.characterId : null;
  const userAlias = typeof b.userAlias === "string" ? b.userAlias.trim().slice(0, 100) : "";
  const content = typeof b.content === "string" ? b.content : "";
  const keywords = Array.isArray(b.keywords)
    ? b.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
    : [];
  const sortOrder = typeof b.sortOrder === "number" && Number.isInteger(b.sortOrder) ? b.sortOrder : 0;

  // Имя обязательно — оно оборачивает текст записи в промпте как <имя>…</имя> (getActiveEntriesForPrompt).
  if (!name) return { error: "Name is required" };
  // Запись должна нести смысл: либо ссылка на персонажа, либо непустой текст.
  if (characterId === null && !content.trim()) {
    return { error: "Entry needs a character or content" };
  }
  return { input: { name, enabled, activation, characterId, userAlias, content, keywords, sortOrder } };
}
