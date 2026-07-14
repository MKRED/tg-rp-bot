/** Опция тега для выпадающего списка Multiselect: сам тег + сколько персонажей его используют. */
export interface TagOption {
  value: string;
  label: string;
  count: number;
}

/**
 * Считает частоты тегов по всем персонажам и возвращает опции для Multiselect, отсортированные
 * по убыванию частоты (при равенстве — по алфавиту).
 *
 * Чистая функция (без React/I/O) — теги уже расшифрованы в CharacterListItem.tags. Агрегируем
 * на фронте: в БД теги шифруются пер-юзер (рандомный IV), так что SQL GROUP BY по ним невозможен.
 *
 * count = «сколько персонажей используют тег», включая самого редактируемого персонажа
 * (его уже сохранённые теги) — а не только «прочих».
 */
export function buildTagOptions(items: { tags: string[] }[]): TagOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ value: tag, label: tag, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
