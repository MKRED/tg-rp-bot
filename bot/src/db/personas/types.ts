/**
 * Поля персоны, которые приходят из формы Mini App (без серверных id/timestamps).
 * footnote хранится только в интерфейсе — в LLM-запрос не передаётся.
 */
export type PersonaInput = {
  name: string;
  prompt: string;
  footnote: string | null;
  image: string | null;
  imageFull: string | null;
};

/**
 * Лёгкая проекция для списка: без image (может весить сотни КБ base64),
 * вместо него флаг hasImage — картинку список грузит построчно через GET /:id/image.
 */
export type PersonaListItem = {
  id: number;
  name: string;
  footnote: string | null;
  hasImage: boolean;
};
