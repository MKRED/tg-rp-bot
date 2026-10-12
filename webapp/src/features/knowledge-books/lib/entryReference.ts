import { DEFAULT_KEYWORD_DEPTH } from "../types/book";

/** Персонаж/персона, на которых может ссылаться запись книги. */
export interface ReferenceItem {
  id: number;
  name: string;
  hasImage: boolean;
}

/** Имя и аватар ссылки из сохранённой записи (сервер отдаёт их резолвом). */
export interface SavedReference {
  id: number | null | undefined;
  name: string | null | undefined;
  hasImage: boolean | undefined;
}

/**
 * Выбранная ссылка для показа. Пока список (useCharacters/usePersonas) грузится, для уже сохранённой
 * записи берём имя/аватар из неё самой — иначе поле на миг мигало бы «Выберите…». Как только список
 * пришёл, он источник истины (свежее имя при переименовании). Выбор в шторке берётся из загруженного
 * списка, поэтому сохранённое подставляем, только если id совпадает с сохранённым.
 */
export function selectedOf(items: ReferenceItem[], id: number | null, saved: SavedReference): ReferenceItem | null {
  const fromList = items.find((it) => it.id === id);
  if (fromList) return fromList;
  if (id != null && id === saved.id && saved.name != null) {
    return { id, name: saved.name, hasImage: saved.hasImage ?? false };
  }
  return null;
}

/** Глубина поиска из NumberInput: пустое поле (строка) → значение по умолчанию; диапазон проверит сервер. */
export function depthOf(value: number | string): number {
  return typeof value === "number" ? value : DEFAULT_KEYWORD_DEPTH;
}
