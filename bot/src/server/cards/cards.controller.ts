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
import { getPreset } from "../../db/presets/index.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { chatCompletionErrorResponse } from "../shared/apiError.js";
import { tryLockCard, unlockCard } from "./cardLock.js";
import { MAX_CARDS_PER_USER } from "./cards.constants.js";
import { parseCardInput } from "./cards.validation.js";
import { generateNextCardBlock } from "./generation/generateBlock.js";

/**
 * presetId опционален (null = пресет ещё не выбран), но если задан — обязан принадлежать
 * пользователю, иначе чужой (но существующий) id прошёл бы FK-ограничение и сохранился бы как
 * будто валидный, а на генерации getPreset (ownership-фильтр) молча вернул бы undefined —
 * пользователь увидел бы вводящий в заблуждение "preset_required". Проверяем явно, как у chats
 * (chats.controller.ts: getPreset → 404 "Preset not found").
 */
async function presetIdValid(userId: number, presetId: number | null): Promise<boolean> {
  if (presetId === null) return true;
  return (await getPreset(userId, presetId)) !== undefined;
}

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
    if (!(await presetIdValid(user.id, parsed.input.presetId))) {
      return c.json({ error: "Preset not found" }, 404);
    }

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
    if (!(await presetIdValid(user.id, parsed.input.presetId))) {
      return c.json({ error: "Preset not found" }, 404);
    }

    // Тот же лок, что у generate-next (cardLock.ts): оба пути делают read-modify-write полной
    // строки, без него параллельные PUT и «Сгенерировать» могли бы затереть друг друга.
    if (!tryLockCard(id)) return c.json({ error: "busy" }, 409);
    try {
      const card = await updateCard(user.id, id, parsed.input);
      if (!card) return c.json({ error: "Not found" }, 404);
      return c.json({ card });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to update card");
      return c.json({ error: "Internal error" }, 500);
    } finally {
      unlockCard(id);
    }
  });

  // Генерация следующего незаполненного блока структуры карточки (см. generateNextCardBlock).
  api.post("/:id/generate-next", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const result = await generateNextCardBlock(user.id, id);
      if (!result.ok) return c.json({ error: result.reason }, result.status);
      return c.json({ categoryId: result.categoryId, content: result.content });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to generate card block");
      return chatCompletionErrorResponse(c, err);
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
