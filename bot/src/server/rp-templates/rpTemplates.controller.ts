import { Hono } from "hono";
import {
  countRpTemplates,
  createRpTemplate,
  deleteRpTemplate,
  getRpTemplate,
  listRpTemplates,
  updateRpTemplate,
} from "../../db/rpTemplates/index.js";
import { ensureUser } from "../../db/users.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { isFkViolation } from "../shared/fkViolation.js";
import { MAX_RP_TEMPLATES_PER_USER } from "./rpTemplates.constants.js";
import { parseRpTemplateInput } from "./rpTemplates.validation.js";

/**
 * CRUD-роуты RP-шаблонов под /api/rp-templates. Монтируются из routes.ts ПОСЛЕ requireInitData,
 * поэтому здесь c.get("tgUser") уже доступен. Все запросы изолированы по владельцу (user_id).
 */
export function createRpTemplateRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      return c.json({ templates: await listRpTemplates(user.id) });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list RP templates");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    const template = await getRpTemplate(user.id, id);
    if (!template) return c.json({ error: "Not found" }, 404);
    return c.json({ template });
  });

  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const parsed = parseRpTemplateInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    try {
      await ensureUser(user);
      if ((await countRpTemplates(user.id)) >= MAX_RP_TEMPLATES_PER_USER) {
        return c.json({ error: `Template limit reached (max ${MAX_RP_TEMPLATES_PER_USER})` }, 400);
      }
      const template = await createRpTemplate(user.id, parsed.input);
      return c.json({ template }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create RP template");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    const parsed = parseRpTemplateInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    const template = await updateRpTemplate(user.id, id, parsed.input);
    if (!template) return c.json({ error: "Not found" }, 404);
    return c.json({ template });
  });

  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deleteRpTemplate(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      // FK нарушение (23503): шаблон привязан к чату (chats.template_id NOT NULL).
      if (isFkViolation(err)) return c.json({ error: "in_use" }, 409);
      logger.error({ err, userId: user.id, id }, "Failed to delete RP template");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
