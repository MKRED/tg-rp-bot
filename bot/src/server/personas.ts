import { Hono } from "hono";
import {
  type PersonaInput,
  countPersonas,
  createPersona,
  deletePersona,
  ensureUser,
  getPersona,
  getPersonaImage,
  getPersonaImageFull,
  listPersonas,
  updatePersona,
} from "../db/personas.js";
import logger from "../logger.js";
import { MAX_IMAGE_CHARS, MAX_IMAGE_FULL_CHARS, parseImageField } from "./imageValidation.js";
import type { AppVariables } from "./initData.js";

/** Проверяет, является ли ошибка нарушением FK-ограничения PostgreSQL (SQLSTATE 23503).
 *  DrizzleQueryError оборачивает нативный PostgresError (postgres.js) в поле .cause,
 *  поэтому проверяем оба уровня — иначе code === "23503" не находится на верхнем уровне. */
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

// Мягкий лимит (дублируется в webapp для блокировки UI — здесь последняя линия защиты).
const MAX_PERSONAS_PER_USER = 50;

/**
 * Разбирает тело запроса в PersonaInput с ручной валидацией.
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
function parsePersonaInput(body: unknown): { input: PersonaInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  const prompt = typeof b.prompt === "string" ? b.prompt : "";

  // footnote опционален: null или отсутствие → нет сноски; строка → сноска.
  let footnote: string | null = null;
  if (b.footnote !== undefined && b.footnote !== null) {
    if (typeof b.footnote !== "string") return { error: "Footnote must be a string" };
    footnote = b.footnote;
  }

  // image/imageFull опциональны: null → нет картинки; строка обязана быть data:image/*-URL.
  const imageParsed = parseImageField(b.image, MAX_IMAGE_CHARS, "Image");
  if ("error" in imageParsed) return { error: imageParsed.error };
  const imageFullParsed = parseImageField(b.imageFull, MAX_IMAGE_FULL_CHARS, "Full image");
  if ("error" in imageFullParsed) return { error: imageFullParsed.error };

  return {
    input: { name, prompt, footnote, image: imageParsed.value, imageFull: imageFullParsed.value },
  };
}

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
