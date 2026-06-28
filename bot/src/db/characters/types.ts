/**
 * Поля персонажа, которые приходят из формы Mini App (без серверных id/timestamps).
 * image — квадратная миниатюра аватара (data URL или null).
 * imageFull — то же фото целиком, без кадрирования (data URL или null) для полноэкранного просмотра.
 */
export type CharacterInput = {
  name: string;
  tags: string[];
  // footnote — примечание «для себя», хранится только в UI (в LLM-запрос не передаётся).
  footnote: string | null;
  prompt: string;
  scenario: string;
  firstMessages: string[];
  image: string | null;
  imageFull: string | null;
};

/**
 * Лёгкая проекция для списка: без самого image (он может весить сотни КБ base64), вместо него
 * только флаг hasImage — саму картинку список грузит построчно через GET /characters/:id/image.
 */
export type CharacterListItem = {
  id: number;
  name: string;
  tags: string[];
  footnote: string | null;
  firstMessageCount: number;
  hasImage: boolean;
};
