/**
 * Валидация полей-картинок (аватары персонажей и персон) для серверных роутов.
 * Картинка приходит как data:image/*-URL; здесь — последняя линия защиты по формату и размеру.
 */

// Потолок размера миниатюры (data URL). ~900 КБ строки ≈ ~675 КБ бинарных данных:
// webapp и так даунскейлит миниатюру до 512px JPEG перед отправкой.
export const MAX_IMAGE_CHARS = 900_000;
// Полноразмерное фото тяжелее миниатюры (webapp ужимает длинную сторону до ~1280px JPEG) —
// отдельный, больший лимит (~1.8 МБ бинарных данных).
export const MAX_IMAGE_FULL_CHARS = 2_500_000;

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
