/** Полная персона из GET /api/personas/:id */
export interface Persona {
  id: number;
  name: string;
  image: string | null;
  footnote: string | null;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

/** Лёгкая проекция для списка (без image). */
export interface PersonaListItem {
  id: number;
  name: string;
  footnote: string | null;
  hasImage: boolean;
}

/** Данные формы для создания/обновления. */
export interface PersonaInput {
  name: string;
  prompt: string;
  footnote: string | null;
  image: string | null;
}

export const MAX_PERSONAS_PER_USER = 50;
