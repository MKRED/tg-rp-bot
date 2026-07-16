import type { Character, Persona } from "../../db/schema.js";
import type { BookInput, EntryInput } from "../../db/knowledge/index.js";

/** Промпт/сценарий персонажа ссылается на {{user}} — карточка не знает, кто отыгрывает за пользователя. */
export function characterNeedsUserAlias(character: Pick<Character, "prompt" | "scenario">): boolean {
  return /\{\{user\}\}/i.test(character.prompt) || /\{\{user\}\}/i.test(character.scenario);
}

/** Промпт персоны ссылается на {{char}} — персона не знает, кто закреплённый персонаж (симметрично). */
export function personaNeedsCharAlias(persona: Pick<Persona, "prompt">): boolean {
  return /\{\{char\}\}/i.test(persona.prompt);
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
  const personaId = typeof b.personaId === "number" ? b.personaId : null;
  const alias = typeof b.alias === "string" ? b.alias.trim().slice(0, 100) : "";
  const content = typeof b.content === "string" ? b.content : "";
  const keywords = Array.isArray(b.keywords)
    ? b.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
    : [];

  // Имя обязательно — оно оборачивает текст записи в промпте как <имя>…</имя> (getActiveEntriesForPrompt).
  if (!name) return { error: "Name is required" };
  // Персонаж и персона одновременно — бессмысленное состояние (какая из двух карточек рендерится?).
  if (characterId !== null && personaId !== null) {
    return { error: "Entry cannot reference both a character and a persona" };
  }
  // Запись должна нести смысл: либо ссылка на персонажа/персону, либо непустой текст.
  if (characterId === null && personaId === null && !content.trim()) {
    return { error: "Entry needs a character, a persona or content" };
  }
  return { input: { name, enabled, activation, characterId, personaId, alias, content, keywords } };
}

/** Тело reorder-запроса: { order: number[] } — id записей книги в новом порядке (полная перестановка). */
export function parseReorderInput(body: unknown): { order: number[] } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const order = (body as Record<string, unknown>).order;
  if (!Array.isArray(order) || !order.every((n) => Number.isInteger(n))) {
    return { error: "order must be an array of integers" };
  }
  return { order: order as number[] };
}
