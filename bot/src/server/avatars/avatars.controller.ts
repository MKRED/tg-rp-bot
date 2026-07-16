import { Hono } from "hono";
import { getAvatarsBatch } from "../../db/avatars/index.js";
import type { AvatarBatchRef } from "../../db/avatars/index.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";

// Ограничивает размер батча — стек в списке (top-3) x страница историй + шапка (top-5)
// с большим запасом; страхует от намеренно раздутого запроса.
const MAX_BATCH_REFS = 60;

function parseRefs(body: unknown): AvatarBatchRef[] | null {
  const refs = (body as { refs?: unknown } | null)?.refs;
  if (!Array.isArray(refs)) return null;
  const parsed: AvatarBatchRef[] = [];
  for (const r of refs) {
    if (
      typeof r === "object" &&
      r !== null &&
      ((r as { type?: unknown }).type === "character" || (r as { type?: unknown }).type === "persona") &&
      Number.isInteger((r as { id?: unknown }).id)
    ) {
      parsed.push({ type: (r as { type: "character" | "persona" }).type, id: (r as { id: number }).id });
    }
  }
  return parsed;
}

/** Батч-резолв аватаров под /api/avatars — источник данных для AvatarStack (список историй, шапка чата). */
export function createAvatarRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Дескрипторы { type, id } → data URL там, где картинка есть (не найденные/чужие/пустые — молча выпадают).
  api.post("/batch", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);

    const refs = parseRefs(await c.req.json().catch(() => null));
    if (refs === null) return c.json({ error: "refs must be an array" }, 400);
    if (refs.length === 0) return c.json({ avatars: [] });
    if (refs.length > MAX_BATCH_REFS) {
      return c.json({ error: `Too many refs (max ${MAX_BATCH_REFS})` }, 400);
    }

    try {
      const avatars = await getAvatarsBatch(user.id, refs);
      return c.json({ avatars });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to batch-load avatars");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
