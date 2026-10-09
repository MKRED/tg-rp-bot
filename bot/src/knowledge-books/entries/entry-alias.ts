import type { Character, Persona } from "../../db/schema.js";

/** Промпт/сценарий персонажа ссылается на {{user}} — карточка не знает, кто отыгрывает за пользователя. */
export function characterNeedsUserAlias(character: Pick<Character, "prompt" | "scenario">): boolean {
  return /\{\{user\}\}/i.test(character.prompt) || /\{\{user\}\}/i.test(character.scenario);
}

/** Промпт персоны ссылается на {{char}} — персона не знает, кто закреплённый персонаж (симметрично). */
export function personaNeedsCharAlias(persona: Pick<Persona, "prompt">): boolean {
  return /\{\{char\}\}/i.test(persona.prompt);
}
