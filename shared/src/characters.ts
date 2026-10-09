// Контракт API персонажей (/api/characters) — общий для bot и webapp.

/**
 * Тело формы создания/редактирования (POST/PUT), без серверных id/timestamps.
 * image — квадратная миниатюра аватара (data URL или null); imageFull — то же фото целиком, без кропа.
 */
export interface CharacterInput {
  name: string;
  tags: string[];
  /** Примечание «для себя» — не уходит в LLM, показывается только в UI. */
  footnote: string | null;
  prompt: string;
  /** Сценарий — промпт, направляющий ИИ по ходу RP (компонент characterScenario в RP-шаблоне). */
  scenario: string;
  firstMessages: string[];
  image: string | null;
  imageFull: string | null;
}

/**
 * Лёгкая строка списка (GET /characters): без самого image (может весить сотни КБ base64), вместо
 * него флаг hasImage — картинку строка списка догружает отдельно через GET /characters/:id/image.
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

// Мягкие лимиты: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_CHARACTERS_PER_USER = 50;
export const MAX_FIRST_MESSAGES = 10;
