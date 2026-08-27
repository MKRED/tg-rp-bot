import type { CardCategory, CardInput } from "../../db/cards/index.js";
import { MAX_CARD_CATEGORIES } from "./cards.constants.js";

/** Разбирает и валидирует один элемент categories. */
function parseCategory(raw: unknown, index: number): { category: CardCategory } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: `Category ${index} must be an object` };
  }
  const c = raw as Record<string, unknown>;

  const id = typeof c.id === "string" ? c.id.trim() : "";
  if (!id) return { error: `Category ${index}: id is required` };

  if (typeof c.title !== "string") return { error: `Category ${index}: title must be a string` };
  if (typeof c.description !== "string") {
    return { error: `Category ${index}: description must be a string` };
  }
  if (typeof c.content !== "string") return { error: `Category ${index}: content must be a string` };
  if (typeof c.enabled !== "boolean") return { error: `Category ${index}: enabled must be a boolean` };

  return {
    category: {
      id,
      title: c.title.trim(),
      description: c.description.trim(),
      content: c.content,
      enabled: c.enabled,
    },
  };
}

/**
 * Разбирает тело запроса в CardInput с ручной валидацией.
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
export function parseCardInput(body: unknown): { input: CardInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  const systemPrompt = typeof b.systemPrompt === "string" ? b.systemPrompt : "";
  const prompt = typeof b.prompt === "string" ? b.prompt : "";

  if (!Array.isArray(b.categories)) return { error: "categories must be an array" };
  if (b.categories.length > MAX_CARD_CATEGORIES) {
    return { error: `Too many categories (max ${MAX_CARD_CATEGORIES})` };
  }
  const categories: CardCategory[] = [];
  const seenIds = new Set<string>();
  for (const [index, raw] of b.categories.entries()) {
    const parsed = parseCategory(raw, index);
    if ("error" in parsed) return { error: parsed.error };
    // Дубликат id ломает точечный мердж по id (setCardCategoryContent на сервере, CategoryList/
    // handleGenerated на клиенте) — content/React key разъедутся между категориями с одним id.
    if (seenIds.has(parsed.category.id)) return { error: `Category ${index}: duplicate id` };
    seenIds.add(parsed.category.id);
    categories.push(parsed.category);
  }

  // presetId опционален: null/отсутствие → пресет не выбран (генерация недоступна до выбора).
  let presetId: number | null = null;
  if (b.presetId !== undefined && b.presetId !== null) {
    if (typeof b.presetId !== "number" || !Number.isInteger(b.presetId)) {
      return { error: "presetId must be an integer" };
    }
    presetId = b.presetId;
  }

  const useWebSearch = typeof b.useWebSearch === "boolean" ? b.useWebSearch : false;
  const useAskUser = typeof b.useAskUser === "boolean" ? b.useAskUser : false;

  return { input: { name, systemPrompt, prompt, categories, presetId, useWebSearch, useAskUser } };
}
