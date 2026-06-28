import { Hono } from "hono";
import {
  countPersonas,
  createPersona,
  deletePersona,
  ensureUser,
  getPersona,
  getPersonaImage,
  getPersonaImageFull,
  listPersonas,
  updatePersona,
} from "../../db/personas/index.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { isFkViolation } from "../shared/fkViolation.js";
import { MAX_PERSONAS_PER_USER } from "./personas.constants.js";
import { parsePersonaInput } from "./personas.validation.js";

/**
 * CRUD-роуты персон под /api/personas. Монтируются из routes.ts ПОСЛЕ requireInitData,
 * поэтому здесь c.get("tgUser") уже доступен. Все запросы изолированы по владельцу (user_id).
 */
export function createPersonaRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Список персон текущего пользователя (метаданные, без image).
  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      const personas = await listPersonas(user.id);
      return c.json({ personas });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list personas");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Одна персона целиком (только своя).
  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const persona = await getPersona(user.id, id);
      if (!persona) return c.json({ error: "Not found" }, 404);
      return c.json({ persona });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get persona");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Аватар персоны как data URL (или null) — отдельным запросом, чтобы список не тянул base64.
  api.get("/:id/image", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const image = await getPersonaImage(user.id, id);
      if (image === undefined) return c.json({ error: "Not found" }, 404);
      return c.json({ dataUrl: image });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get persona image");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Полноразмерное (некадрированное) фото — отдельным запросом при открытии лайтбокса.
  api.get("/:id/image/full", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const imageFull = await getPersonaImageFull(user.id, id);
      if (imageFull === undefined) return c.json({ error: "Not found" }, 404);
      return c.json({ dataUrl: imageFull });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get persona full image");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Создание персоны.
  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);

    const parsed = parsePersonaInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      await ensureUser(user);
      if ((await countPersonas(user.id)) >= MAX_PERSONAS_PER_USER) {
        return c.json({ error: `Persona limit reached (max ${MAX_PERSONAS_PER_USER})` }, 400);
      }
      const persona = await createPersona(user.id, parsed.input);
      return c.json({ persona }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create persona");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Обновление персоны (только своей).
  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const parsed = parsePersonaInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      const persona = await updatePersona(user.id, id, parsed.input);
      if (!persona) return c.json({ error: "Not found" }, 404);
      return c.json({ persona });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to update persona");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Удаление персоны (только своей).
  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deletePersona(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      // FK нарушение (23503): персона привязана к чату.
      if (isFkViolation(err)) return c.json({ error: "in_use" }, 409);
      logger.error({ err, userId: user.id, id }, "Failed to delete persona");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
