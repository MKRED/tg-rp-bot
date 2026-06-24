import { Hono } from "hono";
import {
  type NarratorTemplateInput,
  countNarratorTemplates,
  createNarratorTemplate,
  deleteNarratorTemplate,
  getNarratorTemplate,
  listNarratorTemplates,
  updateNarratorTemplate,
} from "../db/narratorTemplates.js";
import { ensureUser } from "../db/users.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";

const MAX_TEMPLATES_PER_USER = 50;

function parseInput(body: unknown): { input: NarratorTemplateInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    input: {
      name: name.slice(0, 100),
      systemPrompt: str(b.systemPrompt),
      postHistoryInstruction: str(b.postHistoryInstruction),
    },
  };
}

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
    return c.json({ template });
  });

  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const parsed = parseInput(await c.req.json().catch(() => null));
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
    const parsed = parseInput(await c.req.json().catch(() => null));
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
      // story_chats.template_id = set null при удалении → FK-конфликта быть не может.
      const deleted = await deleteNarratorTemplate(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to delete narrator template");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
