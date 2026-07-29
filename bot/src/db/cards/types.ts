/** Поля карточки, которые приходят из формы Mini App (без серверных id/timestamps). */
export type CardInput = {
  name: string;
};

/** Лёгкая проекция для списка: имя + дата обновления (для строки списка «Мастерской»). */
export type CardListItem = {
  id: number;
  name: string;
  updatedAt: Date;
};
