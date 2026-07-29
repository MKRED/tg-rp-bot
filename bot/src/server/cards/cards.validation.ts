import type { CardInput } from "../../db/cards/index.js";

/**
 * Разбирает тело запроса в CardInput с ручной валидацией.
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
export function parseCardInput(body: unknown): { input: CardInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  return { input: { name } };
}
