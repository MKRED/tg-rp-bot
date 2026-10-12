/**
 * Выбор приветствия в форме нового чата: индекс в firstMessages персонажа, "random" — случайное,
 * null — у персонажа нет приветствий (чат начнётся пустым).
 */
export type GreetingChoice = number | "random" | null;

/** Выбор по умолчанию для персонажа с `count` приветствиями: первое, либо null, если их нет. */
export function defaultGreeting(count: number): GreetingChoice {
  return count > 0 ? 0 : null;
}

/**
 * Индекс приветствия для запроса создания чата. "random" разыгрывается здесь, на клиенте; null → 0
 * (сервер вернёт firstMessages[0] ?? null, то есть чат без стартового сообщения).
 */
export function resolveGreetingIndex(choice: GreetingChoice, count: number, random: () => number = Math.random): number {
  if (choice === "random") return count > 0 ? Math.floor(random() * count) : 0;
  return choice ?? 0;
}
