// Контракт API персон (/api/personas) — общий для bot и webapp.

/** Тело формы создания/редактирования (POST/PUT), без серверных id/timestamps. */
export interface PersonaInput {
  name: string;
  prompt: string;
  /** Примечание «для себя» — не уходит в LLM, показывается только в UI. */
  footnote: string | null;
  image: string | null;
  imageFull: string | null;
}

/**
 * Лёгкая строка списка (GET /personas): без image (может весить сотни КБ base64), вместо него
 * флаг hasImage — картинку список грузит построчно через GET /personas/:id/image.
 */
export interface PersonaListItem {
  id: number;
  name: string;
  footnote: string | null;
  hasImage: boolean;
}

// Мягкий лимит: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_PERSONAS_PER_USER = 50;
