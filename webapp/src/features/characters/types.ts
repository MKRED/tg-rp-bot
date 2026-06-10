/** Полный персонаж, как его отдаёт сервер (GET /characters/:id). */
export interface Character {
  id: number;
  name: string;
  image: string | null;
  tags: string[];
  prompt: string;
  firstMessages: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Лёгкая строка списка (GET /characters) — без самого image и текстов. Вместо аватара только
 * флаг hasImage: картинку строка списка догружает отдельным запросом (useCharacterImage).
 */
export interface CharacterListItem {
  id: number;
  name: string;
  tags: string[];
  firstMessageCount: number;
  hasImage: boolean;
}

/** Тело формы создания/редактирования (POST/PUT). image — аватар как data URL или null. */
export interface CharacterInput {
  name: string;
  tags: string[];
  prompt: string;
  firstMessages: string[];
  image: string | null;
}

/** Мягкие лимиты — дублируют серверные (bot/src/server/characters.ts), блокируют UI заранее. */
export const MAX_CHARACTERS_PER_USER = 50;
export const MAX_FIRST_MESSAGES = 10;
