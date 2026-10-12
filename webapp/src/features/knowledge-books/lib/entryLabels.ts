import type { Entry } from "../types/book";

/** Название строки записи: своё имя, иначе имя персонажа/персоны, иначе «Без названия». */
export function entryTitle(e: Entry): string {
  return e.name || e.characterName || e.personaName || "Без названия";
}

/**
 * Подпись строки записи: на что ссылается (или начало текста) и особый статус — выключена или
 * срабатывает только по ключевым словам. Записи «всегда» без пометки — это обычный случай.
 */
export function entryDescription(e: Entry): string {
  const subject =
    e.characterId != null
      ? `Персонаж: ${e.characterName ?? "удалён"}`
      : e.personaId != null
        ? `Персона: ${e.personaName ?? "удалена"}`
        : e.content;
  const status = !e.enabled ? "выключена" : e.activation === "keyword" ? "по ключевым словам" : null;
  return status ? `${status} · ${subject}` : subject;
}
