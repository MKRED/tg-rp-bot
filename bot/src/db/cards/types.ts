import type { CardCategory } from "../schema.js";

export type { CardCategory };

/** Поля карточки, которые приходят из формы Mini App (без серверных id/timestamps). */
export type CardInput = {
  name: string;
  systemPrompt: string;
  prompt: string;
  categories: CardCategory[];
  presetId: number | null;
  useWebSearch: boolean;
  useAskUser: boolean;
};

/** Лёгкая проекция для списка: имя + дата обновления (для строки списка «Мастерской»). */
export type CardListItem = {
  id: number;
  name: string;
  updatedAt: Date;
};
