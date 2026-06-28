import { Hono } from "hono";
import {
  countCharacters,
  createCharacter,
  deleteCharacter,
  ensureUser,
  getCharacter,
  getCharacterImage,
  getCharacterImageFull,
  listCharacters,
  updateCharacter,
} from "../../db/characters/index.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { isFkViolation } from "../shared/fkViolation.js";
import { MAX_CHARACTERS_PER_USER } from "./characters.constants.js";
import { parseCharacterInput } from "./characters.validation.js";

/**
 * CRUD-роуты персонажей под /api/characters. Монтируются из routes.ts ПОСЛЕ requireInitData,
 * поэтому здесь c.get("tgUser") уже доступен. Все запросы изолированы по владельцу (user_id).
 */
export function createCharacterRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Список персонажей текущего пользователя (метаданные, без image).
  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      const characters = await listCharacters(user.id);
      return c.json({ characters });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list characters");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Один персонаж целиком (только свой).
  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const character = await getCharacter(user.id, id);
      if (!character) return c.json({ error: "Not found" }, 404);
      return c.json({ character });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get character");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Аватар персонажа как data URL (или null) — отдельным запросом, чтобы список не тянул base64
  // всех персонажей. Форма редактирования картинку отдельно НЕ грузит: GET /:id уже отдаёт image.
  // Путь /:id/image не конфликтует с /:id — Hono матчит посегментно. Само изображение не логируем.
  api.get("/:id/image", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const image = await getCharacterImage(user.id, id);
      if (image === undefined) return c.json({ error: "Not found" }, 404);
      return c.json({ dataUrl: image }); // image: string | null
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get character image");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Полноразмерное (некадрированное) фото — отдельным запросом при открытии лайтбокса.
  // Сегментов больше, чем у /:id/image, поэтому маршруты не конфликтуют. Фото не логируем.
  api.get("/:id/image/full", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const imageFull = await getCharacterImageFull(user.id, id);
      if (imageFull === undefined) return c.json({ error: "Not found" }, 404);
      return c.json({ dataUrl: imageFull }); // imageFull: string | null
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get character full image");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Создание персонажа.
  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);

    const parsed = parseCharacterInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      // Сначала гарантируем строку в users (FK), затем проверяем лимит.
      await ensureUser(user);
      if ((await countCharacters(user.id)) >= MAX_CHARACTERS_PER_USER) {
        return c.json({ error: `Character limit reached (max ${MAX_CHARACTERS_PER_USER})` }, 400);
      }
      const character = await createCharacter(user.id, parsed.input);
      return c.json({ character }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create character");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Обновление персонажа (только своего).
  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const parsed = parseCharacterInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      const character = await updateCharacter(user.id, id, parsed.input);
      if (!character) return c.json({ error: "Not found" }, 404);
      return c.json({ character });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to update character");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Удаление персонажа (только своего).
  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deleteCharacter(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      // FK нарушение (23503): персонаж привязан к чату — возвращаем 409 вместо 500.
      if (isFkViolation(err)) return c.json({ error: "in_use" }, 409);
      logger.error({ err, userId: user.id, id }, "Failed to delete character");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
