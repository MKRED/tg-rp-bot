/** Кто автор реплики: игрок, персонаж или рассказчик (нарратор сцены). */
export type Author = "user" | "character" | "narrator";

/** Одна реплика в RP-сцене. */
export interface RpMessage {
  id: string;
  author: Author;
  text: string;
  /** Время отправки (мс, Date.now()). */
  at: number;
}

/** Персонаж, с которым идёт ролевая игра. */
export interface Character {
  name: string;
  /** Короткая подпись под именем (роль/статус сцены). */
  tagline: string;
  /** Эмодзи-аватар (заглушка до настоящих изображений). */
  avatarEmoji: string;
}
