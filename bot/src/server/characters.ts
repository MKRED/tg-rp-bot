import { Hono } from "hono";
import {
  type CharacterInput,
  countCharacters,
  createCharacter,
  deleteCharacter,
  ensureUser,
  getCharacter,
  getCharacterImage,
  getCharacterImageFull,
  listCharacters,
  updateCharacter,
} from "../db/characters.js";
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

// Мягкие лимиты (дублируются в webapp для блокировки UI — здесь последняя линия защиты).
const MAX_CHARACTERS_PER_USER = 50;
const MAX_FIRST_MESSAGES = 10;

/**
 * Разбирает тело запроса в CharacterInput с ручной валидацией (без отдельной зависимости).
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
function parseCharacterInput(body: unknown): { input: CharacterInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  const scenario = typeof b.scenario === "string" ? b.scenario : "";

  if (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === "string")) {
    return { error: "Tags must be an array of strings" };
  }
  if (!Array.isArray(b.firstMessages) || !b.firstMessages.every((m) => typeof m === "string")) {
    return { error: "firstMessages must be an array of strings" };
  }
  if (b.firstMessages.length > MAX_FIRST_MESSAGES) {
    return { error: `Too many first messages (max ${MAX_FIRST_MESSAGES})` };
  }

  // footnote опционален: null/отсутствие/пустая строка → нет примечания; непустая строка → примечание.
  let footnote: string | null = null;
  if (b.footnote !== undefined && b.footnote !== null) {
    if (typeof b.footnote !== "string") return { error: "Footnote must be a string" };
    footnote = b.footnote || null; // защита «последнего рубежа»: пустую строку храним как null
  }

  // image/imageFull опциональны: отсутствует/null → нет картинки; строка обязана быть data:image/*-URL.
  const imageParsed = parseImageField(b.image, MAX_IMAGE_CHARS, "Image");
  if ("error" in imageParsed) return { error: imageParsed.error };
  const imageFullParsed = parseImageField(b.imageFull, MAX_IMAGE_FULL_CHARS, "Full image");
  if ("error" in imageFullParsed) return { error: imageFullParsed.error };

  return {
    input: {
      name,
      prompt,
      scenario,
      tags: b.tags as string[],
      footnote,
      firstMessages: b.firstMessages as string[],
      image: imageParsed.value,
      imageFull: imageFullParsed.value,
    },
  };
}

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
