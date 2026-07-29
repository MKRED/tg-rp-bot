/** Полная карточка, как её отдаёт сервер (GET /cards/:id). */
export interface Card {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Строка списка (GET /cards) — имя + дата обновления для «Мастерской». */
export interface CardListItem {
  id: number;
  name: string;
  updatedAt: string;
}

/** Тело формы создания/редактирования (POST/PUT). */
export interface CardInput {
  name: string;
}

/** Мягкий лимит — дублирует серверный (bot/src/server/cards/cards.constants.ts), блокирует UI заранее. */
export const MAX_CARDS_PER_USER = 50;
