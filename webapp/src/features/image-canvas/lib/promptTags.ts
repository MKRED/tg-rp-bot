/** Наибольший номер `<imageN>` в промпте (0 — тегов нет). Та же проверка есть на сервере. */
export function maxImageTag(prompt: string): number {
  let max = 0;
  for (const match of prompt.matchAll(/<image(\d+)>/g)) max = Math.max(max, Number(match[1]));
  return max;
}

/**
 * Вставляет `<imageN>` на место выделения и возвращает новый текст и позицию курсора за тегом.
 * Пробелы по краям — только если тег иначе слипся бы со словом.
 */
export function insertImageTag(text: string, start: number, end: number, n: number): { text: string; cursor: number } {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const tag = `${before && !/\s$/.test(before) ? " " : ""}<image${n}>${after && !/^[\s.,;:!?]/.test(after) ? " " : ""}`;
  return { text: before + tag + after, cursor: before.length + tag.length };
}

/** Почему нельзя запустить генерацию; null — можно. */
export function generateBlocker(prompt: string, references: number): string | null {
  if (references === 0) return "Прикрепите картинку, которую нужно изменить";
  if (!prompt.trim()) return "Напишите, что сделать с картинкой";
  const tag = maxImageTag(prompt);
  if (tag > references) return `В промпте есть <image${tag}>, а картинок ${references}`;
  return null;
}
