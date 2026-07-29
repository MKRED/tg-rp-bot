import { Hono } from "hono";
import {
  countCards,
  createCard,
  deleteCard,
  ensureUser,
  getCard,
  listCards,
  updateCard,
} from "../../db/cards/index.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { MAX_CARDS_PER_USER } from "./cards.constants.js";
import { parseCardInput } from "./cards.validation.js";

/**
 * CRUD-роуты карточек «Мастерской» под /api/cards. Монтируются из routes.ts ПОСЛЕ requireInitData,
 * поэтому здесь c.get("tgUser") уже доступен. Все запросы изолированы по владельцу (user_id).
 */
export function createCardRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Список карточек текущего пользователя.
  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      const cards = await listCards(user.id);
      return c.json({ cards });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list cards");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Одна карточка целиком (только своя).
  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const card = await getCard(user.id, id);
      if (!card) return c.json({ error: "Not found" }, 404);
      return c.json({ card });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get card");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Создание карточки.
  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);

    const parsed = parseCardInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      await ensureUser(user);
      if ((await countCards(user.id)) >= MAX_CARDS_PER_USER) {
        return c.json({ error: `Card limit reached (max ${MAX_CARDS_PER_USER})` }, 400);
      }
      const card = await createCard(user.id, parsed.input);
      return c.json({ card }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create card");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Обновление карточки (только своей).
  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const parsed = parseCardInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      const card = await updateCard(user.id, id, parsed.input);
      if (!card) return c.json({ error: "Not found" }, 404);
      return c.json({ card });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to update card");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Удаление карточки (только своей).
  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deleteCard(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to delete card");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
