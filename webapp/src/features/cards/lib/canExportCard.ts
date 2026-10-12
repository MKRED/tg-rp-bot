import type { CardCategory } from "../types/card";

/**
 * Генерировать больше нечего — есть включённые категории, и все они заполнены. Только тогда
 * карточку есть смысл выгружать в персонажа/персону (кнопка видна всегда, но выключена).
 */
export function canExportCard(categories: CardCategory[]): boolean {
  const enabled = categories.filter((c) => c.enabled);
  return enabled.length > 0 && enabled.every((c) => c.content.trim().length > 0);
}
