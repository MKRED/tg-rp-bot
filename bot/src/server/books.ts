import { Hono } from "hono";
import { getCharacter } from "../db/characters.js";
import {
  type BookInput,
  type EntryInput,
  countBooks,
  countEntries,
  createBook,
  createEntry,
  deleteBook,
  deleteEntry,
  getBook,
  listBooks,
  listEntries,
  updateBook,
  updateEntry,
} from "../db/knowledge/index.js";
import { ensureUser } from "../db/users.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";

/** Нарушение FK-ограничения PostgreSQL (23503) — книга используется историей. */
const isFkViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e.code === "23503") return true;
  const cause = e.cause as Record<string, unknown> | undefined;
  return typeof cause === "object" && cause !== null && cause.code === "23503";
};

const MAX_BOOKS_PER_USER = 50;
const MAX_ENTRIES_PER_BOOK = 200;

function parseBookInput(body: unknown): { input: BookInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };
  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 2000) : null;
  return { input: { name: name.slice(0, 100), description } };
}

function parseEntryInput(body: unknown): { input: EntryInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 100) : "";
  const enabled = b.enabled !== false;
  const activation = b.activation === "keyword" ? "keyword" : "always_on";
  const characterId = typeof b.characterId === "number" ? b.characterId : null;
  const content = typeof b.content === "string" ? b.content : "";
  const keywords = Array.isArray(b.keywords)
    ? b.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
    : [];
  const sortOrder = typeof b.sortOrder === "number" && Number.isInteger(b.sortOrder) ? b.sortOrder : 0;

  // Запись должна нести смысл: либо ссылка на персонажа, либо непустой текст.
  if (characterId === null && !content.trim()) {
    return { error: "Entry needs a character or content" };
  }
  return { input: { name, enabled, activation, characterId, content, keywords, sortOrder } };
}

/** CRUD книг знаний (+ их записей) под /api/books. Монтируется после requireInitData. */
export function createBookRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      return c.json({ books: await listBooks(user.id) });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list books");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const parsed = parseBookInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    try {
      await ensureUser(user);
      if ((await countBooks(user.id)) >= MAX_BOOKS_PER_USER) {
        return c.json({ error: `Book limit reached (max ${MAX_BOOKS_PER_USER})` }, 400);
      }
      const book = await createBook(user.id, parsed.input);
      return c.json({ book }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create book");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    const book = await getBook(user.id, id);
    if (!book) return c.json({ error: "Not found" }, 404);
    return c.json({ book });
  });

  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    const parsed = parseBookInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    const book = await updateBook(user.id, id, parsed.input);
    if (!book) return c.json({ error: "Not found" }, 404);
    return c.json({ book });
  });

  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deleteBook(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      if (isFkViolation(err)) return c.json({ error: "in_use" }, 409);
      logger.error({ err, userId: user.id, id }, "Failed to delete book");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // ─── Записи книги ─────────────────────────────────────────────────────────

  api.get("/:id/entries", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    // listEntries сама проверяет владение книгой; для несуществующей вернёт [].
    return c.json({ entries: await listEntries(user.id, id) });
  });

  api.post("/:id/entries", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    const parsed = parseEntryInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    // Запись-персонаж: персонаж должен принадлежать пользователю.
    if (parsed.input.characterId !== null) {
      const ch = await getCharacter(user.id, parsed.input.characterId);
      if (!ch) return c.json({ error: "Character not found" }, 404);
    }
    if ((await countEntries(user.id, id)) >= MAX_ENTRIES_PER_BOOK) {
      return c.json({ error: `Entry limit reached (max ${MAX_ENTRIES_PER_BOOK})` }, 400);
    }
    const created = await createEntry(user.id, id, parsed.input);
    if (!created) return c.json({ error: "Book not found" }, 404);
    return c.json({ entry: { id: created.id } }, 201);
  });

  api.put("/:id/entries/:entryId", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const entryId = Number(c.req.param("entryId"));
    if (!Number.isInteger(entryId)) return c.json({ error: "Invalid id" }, 400);
    const parsed = parseEntryInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    if (parsed.input.characterId !== null) {
      const ch = await getCharacter(user.id, parsed.input.characterId);
      if (!ch) return c.json({ error: "Character not found" }, 404);
    }
    const ok = await updateEntry(user.id, entryId, parsed.input);
    if (!ok) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  api.delete("/:id/entries/:entryId", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const entryId = Number(c.req.param("entryId"));
    if (!Number.isInteger(entryId)) return c.json({ error: "Invalid id" }, 400);
    const ok = await deleteEntry(user.id, entryId);
    if (!ok) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  return api;
}
