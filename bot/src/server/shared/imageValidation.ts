/**
 * Валидация полей-картинок (аватары персонажей и персон) для серверных роутов.
 * Картинка приходит как data:image/*-URL; здесь — последняя линия защиты по формату и размеру.
 */

/**
 * Валидирует поле-картинку (data:image/*-URL или null/отсутствует) с лимитом размера.
 * Возвращает значение для записи (string | null) либо текст ошибки для ответа 400.
 */
export function parseImageField(
  value: unknown,
  maxChars: number,
  label: string,
): { value: string | null } | { error: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    return { error: `${label} must be a data:image/* URL` };
  }
  if (value.length > maxChars) return { error: `${label} too large` };
  return { value };
}
