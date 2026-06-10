import type { Character, RpMessage } from "../types/chat";

/** Демонстрационный персонаж сцены. */
export const MOCK_CHARACTER: Character = {
  name: "Лира",
  tagline: "Странница из Сумеречного леса",
  avatarEmoji: "🧝‍♀️",
};

/** Стартовые реплики сцены (нарратор задаёт обстановку, персонаж завязывает диалог). */
export const INITIAL_MESSAGES: RpMessage[] = [
  {
    id: "m0",
    author: "narrator",
    text: "Костёр потрескивает в ночи. Из тени деревьев выходит фигура в плаще.",
    at: Date.now() - 60_000,
  },
  {
    id: "m1",
    author: "character",
    text: "— Не ждала здесь встретить путника. Ты тоже сбился с дороги?",
    at: Date.now() - 50_000,
  },
];

// Заглушки ответов персонажа: используются, пока не подключён серверный вызов OpenRouter.
const CHARACTER_REPLIES: string[] = [
  "— Любопытно... Расскажи мне больше.",
  "— Лира прищурилась, вглядываясь в твоё лицо. — И что же ты намерен делать дальше?",
  "— Она усмехнулась и подбросила ветку в костёр. — Смелое решение.",
  "— Ветер донёс далёкий вой. — Нам стоит поторопиться.",
];

/** Возвращает псевдослучайный ответ персонажа (временная замена LLM). */
export function mockCharacterReply(): string {
  const i = Math.floor(Math.random() * CHARACTER_REPLIES.length);
  return CHARACTER_REPLIES[i] ?? CHARACTER_REPLIES[0]!;
}
