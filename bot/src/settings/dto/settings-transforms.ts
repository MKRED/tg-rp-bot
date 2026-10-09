import { Transform } from "class-transformer";

/**
 * PATCH /settings/* исторически снисходителен: поле неподходящего типа/значения не даёт 400, а
 * просто игнорируется (undefined — «не трогать»). Эти трансформы приводят сырое значение к
 * значению патча ДО валидаторов, поэтому валидаторы в DTO нужны только для whitelist и типов.
 * Дефолтов у полей нет намеренно: дефолт превратил бы «не трогать» в перезапись.
 */

/** Новый ключ: null — удалить, строка — обрезается (формат проверяет сервис), прочее — не трогать. */
export const ApiKeyPatch = () =>
  Transform(({ value }: { value: unknown }) => (value === null ? null : typeof value === "string" ? value.trim() : undefined));

/** Непустая строка после trim, иначе — не трогать. */
export const TrimmedNonEmpty = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === "string" && value.trim() ? value.trim() : undefined));

/** Значение из допустимого набора, иначе — не трогать. */
export const OneOf = (allowed: readonly unknown[]) =>
  Transform(({ value }: { value: unknown }) => (allowed.includes(value) ? value : undefined));
