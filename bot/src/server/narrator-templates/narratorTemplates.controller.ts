import { Hono } from "hono";
import {
  countNarratorTemplates,
  createNarratorTemplate,
  deleteNarratorTemplate,
  getNarratorTemplate,
  listNarratorTemplates,
  updateNarratorTemplate,
} from "../../db/narratorTemplates/index.js";
import { ensureUser } from "../../db/users.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { normalizeStoryPromptOrder } from "../prompt/storyPromptOrder.js";
import { isFkViolation } from "../shared/fkViolation.js";
import { MAX_TEMPLATES_PER_USER } from "./narratorTemplates.constants.js";
import { parseNarratorTemplateInput } from "./narratorTemplates.validation.js";

/** CRUD narrator-шаблонов под /api/narrator-templates. Монтируется после requireInitData. */
export function createNarratorTemplateRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      return c.json({ templates: await listNarratorTemplates(user.id) });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list narrator templates");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    const template = await getNarratorTemplate(user.id, id);
    if (!template) return c.json({ error: "Not found" }, 404);
    // Нормализуем порядок: старые шаблоны (6 компонентов) дополняются `compact` на дефолтную позицию.
    return c.json({ template: { ...template, promptOrder: normalizeStoryPromptOrder(template.promptOrder) } });
  });

  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const parsed = parseNarratorTemplateInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    try {
      await ensureUser(user);
      if ((await countNarratorTemplates(user.id)) >= MAX_TEMPLATES_PER_USER) {
        return c.json({ error: `Template limit reached (max ${MAX_TEMPLATES_PER_USER})` }, 400);
      }
      const template = await createNarratorTemplate(user.id, parsed.input);
      return c.json({ template }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create narrator template");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    const parsed = parseNarratorTemplateInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    const template = await updateNarratorTemplate(user.id, id, parsed.input);
    if (!template) return c.json({ error: "Not found" }, 404);
    return c.json({ template });
  });

  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deleteNarratorTemplate(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      // FK нарушение (23503): шаблон привязан к истории (story_chats.template_id NOT NULL).
      if (isFkViolation(err)) return c.json({ error: "in_use" }, 409);
      logger.error({ err, userId: user.id, id }, "Failed to delete narrator template");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
