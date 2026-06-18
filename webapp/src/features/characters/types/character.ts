/** Полный персонаж, как его отдаёт сервер (GET /characters/:id). */
export interface Character {
  id: number;
  name: string;
  image: string | null;
  imageFull: string | null;
  tags: string[];
  /** Примечание «для себя» — не уходит в LLM, показывается только в UI. */
  footnote: string | null;
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
  /** Примечание «для себя» (расшифровано сервером); заполненное показывается в строке списка. */
  footnote: string | null;
  firstMessageCount: number;
  hasImage: boolean;
}

/**
 * Тело формы создания/редактирования (POST/PUT).
 * image — квадратная миниатюра (data URL или null); imageFull — то же фото целиком (без кропа).
 */
export interface CharacterInput {
  name: string;
  tags: string[];
  /** Примечание «для себя» — не уходит в LLM. */
  footnote: string | null;
  prompt: string;
  firstMessages: string[];
  image: string | null;
  imageFull: string | null;
}

/** Мягкие лимиты — дублируют серверные (bot/src/server/characters.ts), блокируют UI заранее. */
export const MAX_CHARACTERS_PER_USER = 50;
export const MAX_FIRST_MESSAGES = 10;
