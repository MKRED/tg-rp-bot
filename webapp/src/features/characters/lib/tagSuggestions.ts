/** Тег-подсказка: сам тег + сколько персонажей его используют. */
export interface TagSuggestion {
  tag: string;
  count: number;
}

/**
 * Считает частоты тегов по всем персонажам и возвращает отсортированные подсказки.
 *
 * Чистая функция (без React/I/O) — теги уже расшифрованы в CharacterListItem.tags. Агрегируем
 * на фронте: в БД теги шифруются пер-юзер (рандомный IV), так что SQL GROUP BY по ним невозможен.
 *
 * - count = «сколько персонажей используют тег» (включая редактируемого — его сохранённые теги).
 * - Исключаем уже выбранные (selected) теги — их добавлять незачем.
 * - Фильтруем по подстроке draft (case-insensitive). Пустой draft → все популярные.
 * - Сортировка: по убыванию частоты, при равенстве — по алфавиту. Отдаём не более limit штук.
 */
export function buildTagSuggestions(
  items: { tags: string[] }[],
  selected: string[],
  draft: string,
  limit = 8,
): TagSuggestion[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const selectedSet = new Set(selected);
  const query = draft.trim().toLowerCase();

  const result: TagSuggestion[] = [];
  for (const [tag, count] of counts) {
    if (selectedSet.has(tag)) continue;
    if (query && !tag.toLowerCase().includes(query)) continue;
    result.push({ tag, count });
  }

  result.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  return result.slice(0, limit);
}
