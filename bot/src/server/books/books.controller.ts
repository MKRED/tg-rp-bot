import { Hono } from "hono";
import { getCharacter } from "../../db/characters/index.js";
import {
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
} from "../../db/knowledge/index.js";
import { ensureUser } from "../../db/users.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { isFkViolation } from "../shared/fkViolation.js";
import { MAX_BOOKS_PER_USER, MAX_ENTRIES_PER_BOOK } from "./books.constants.js";
import { parseBookInput, parseEntryInput } from "./books.validation.js";

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
