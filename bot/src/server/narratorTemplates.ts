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
import type { StoryPromptComponentId, StoryPromptOrderItem } from "../db/schema.js";
import { ensureUser } from "../db/users.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";
import { DEFAULT_NARRATOR_PROMPT_ORDER } from "./storyPromptBuilder.js";

const MAX_TEMPLATES_PER_USER = 50;

// Канонический набор narrator-компонентов — promptOrder обязан содержать ровно их (по разу).
const STORY_PROMPT_COMPONENT_IDS: StoryPromptComponentId[] = [
  "system",
  "premise",
  "lorebook",
  "auxiliary",
  "history",
  "postHistory",
];

/** promptOrder: массив ровно из известных компонентов (по разу) с boolean-флагом enabled. */
function parsePromptOrder(value: unknown): StoryPromptOrderItem[] | undefined {
  if (!Array.isArray(value) || value.length !== STORY_PROMPT_COMPONENT_IDS.length) return undefined;
  const seen = new Set<string>();
  const result: StoryPromptOrderItem[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return undefined;
    const it = item as Record<string, unknown>;
    if (
      typeof it.id !== "string" ||
      !STORY_PROMPT_COMPONENT_IDS.includes(it.id as StoryPromptComponentId)
    ) {
      return undefined;
    }
    if (typeof it.enabled !== "boolean") return undefined;
    if (seen.has(it.id)) return undefined; // дубль
    seen.add(it.id);
    result.push({ id: it.id as StoryPromptComponentId, enabled: it.enabled });
  }
  return result;
}

/** Проверяет, является ли ошибка нарушением FK-ограничения PostgreSQL (SQLSTATE 23503).
 *  DrizzleQueryError оборачивает нативный PostgresError в .cause — проверяем оба уровня. */
const isFkViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e.code === "23503") return true;
  const cause = e.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in (cause as object) &&
    (cause as Record<string, unknown>).code === "23503"
  );
};

function parseInput(body: unknown): { input: NarratorTemplateInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  // Порядок необязателен в запросе: если не пришёл — берём дефолт; если пришёл битым — 400.
  const promptOrder =
    b.promptOrder === undefined ? DEFAULT_NARRATOR_PROMPT_ORDER : parsePromptOrder(b.promptOrder);
  if (!promptOrder) return { error: "Invalid promptOrder" };
  return {
    input: {
      name: name.slice(0, 100),
      systemPrompt: str(b.systemPrompt),
      auxiliarySystemPrompt: str(b.auxiliarySystemPrompt),
      postHistoryInstruction: str(b.postHistoryInstruction),
      promptOrder,
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
