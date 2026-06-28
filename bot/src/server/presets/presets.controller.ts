import { Hono } from "hono";
import {
  countPresets,
  createPreset,
  deletePreset,
  getPreset,
  listPresets,
  updatePreset,
} from "../../db/presets/index.js";
import { ensureUser } from "../../db/users.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { isFkViolation } from "../shared/fkViolation.js";
import { MAX_PRESETS_PER_USER } from "./presets.constants.js";
import { parsePresetInput } from "./presets.validation.js";

/**
 * CRUD-роуты пресетов под /api/presets. Монтируются из routes.ts ПОСЛЕ requireInitData,
 * поэтому здесь c.get("tgUser") уже доступен. Все запросы изолированы по владельцу (user_id).
 */
export function createPresetRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Список пресетов текущего пользователя (id + название).
  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      const presets = await listPresets(user.id);
      return c.json({ presets });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list presets");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Один пресет целиком (только свой).
  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const preset = await getPreset(user.id, id);
      if (!preset) return c.json({ error: "Not found" }, 404);
      return c.json({ preset });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Создание пресета.
  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);

    const parsed = parsePresetInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      // Сначала гарантируем строку в users (FK), затем проверяем лимит.
      await ensureUser(user);
      if ((await countPresets(user.id)) >= MAX_PRESETS_PER_USER) {
        return c.json({ error: `Preset limit reached (max ${MAX_PRESETS_PER_USER})` }, 400);
      }
      const preset = await createPreset(user.id, parsed.input);
      return c.json({ preset }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Обновление пресета (только своего).
  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const parsed = parsePresetInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      const preset = await updatePreset(user.id, id, parsed.input);
      if (!preset) return c.json({ error: "Not found" }, 404);
      return c.json({ preset });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to update preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Удаление пресета (только своего).
  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deletePreset(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      // FK нарушение (23503): пресет привязан к чату.
      if (isFkViolation(err)) return c.json({ error: "in_use" }, 409);
      logger.error({ err, userId: user.id, id }, "Failed to delete preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
