import { Hono } from "hono";
import { getBook } from "../db/knowledge/index.js";
import { getNarratorTemplate } from "../db/narratorTemplates.js";
import { getPreset } from "../db/presets.js";
import { createStory, deleteStory, getStory, listStories, renameStory } from "../db/stories/index.js";
import { ensureUser } from "../db/users.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";
import {
  handleAdvanceStory,
  handleDeleteStoryMessage,
  handleRegenerateStoryBeat,
  handleSwitchStoryBranch,
} from "./storyHandlers.js";

/** CRUD narrator-историй + ведение (advance/regenerate/branch/delete) под /api/stories. */
export function createStoryRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize") ?? 20)));
    try {
      const { items, total } = await listStories(user.id, page, pageSize);
      return c.json({ items, total, page, pageSize });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list stories");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  app.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const userId = user.id;
    const body = (await c.req.json().catch(() => ({}))) as {
      bookId?: unknown;
      templateId?: unknown;
      presetId?: unknown;
      openingBeat?: unknown;
      premise?: unknown;
    };

    // ВРЕМЕННАЯ ДИАГНОСТИКА: тост «Не удалось создать историю» при тихом 4xx без логов.
    // Логируем сам факт входа в хендлер, userId и типы/значения id, чтобы понять, какая ветка отказа.
    logger.info(
      {
        userId,
        bookId: body.bookId,
        bookIdType: typeof body.bookId,
        templateId: body.templateId,
        templateIdType: typeof body.templateId,
        presetId: body.presetId,
        presetIdType: typeof body.presetId,
        openingBeatLen: typeof body.openingBeat === "string" ? body.openingBeat.length : null,
      },
      "DIAG story create: request received",
    );

    const bookId = typeof body.bookId === "number" ? body.bookId : null;
    if (bookId === null) {
      logger.warn({ userId, bookId: body.bookId }, "DIAG story create: bookId missing/not number → 400");
      return c.json({ error: "bookId is required" }, 400);
    }

    // Стартовое сообщение (openingBeat) — ОБЯЗАТЕЛЬНО.
    const openingBeat = typeof body.openingBeat === "string" ? body.openingBeat.trim() : "";
    if (!openingBeat) {
      logger.warn({ userId }, "DIAG story create: openingBeat empty → 400");
      return c.json({ error: "openingBeat is required" }, 400);
    }

    const premise = typeof body.premise === "string" ? body.premise.trim() : "";

    // Шаблон и пресет — ОБЯЗАТЕЛЬНЫ (как книга).
    const templateId = typeof body.templateId === "number" ? body.templateId : null;
    if (templateId === null) {
      logger.warn({ userId, templateId: body.templateId }, "DIAG story create: templateId missing/not number → 400");
      return c.json({ error: "templateId is required" }, 400);
    }
    const presetId = typeof body.presetId === "number" ? body.presetId : null;
    if (presetId === null) {
      logger.warn({ userId, presetId: body.presetId }, "DIAG story create: presetId missing/not number → 400");
      return c.json({ error: "presetId is required" }, 400);
    }

    try {
      await ensureUser(user);

      // Все привязки должны принадлежать пользователю.
      const book = await getBook(userId, bookId);
      if (!book) {
        logger.warn({ userId, bookId }, "DIAG story create: book not found for user → 404");
        return c.json({ error: "Book not found" }, 404);
      }
      if (!(await getNarratorTemplate(userId, templateId))) {
        logger.warn({ userId, templateId }, "DIAG story create: template not found for user → 404");
        return c.json({ error: "Template not found" }, 404);
      }
      if (!(await getPreset(userId, presetId))) {
        logger.warn({ userId, presetId }, "DIAG story create: preset not found for user → 404");
        return c.json({ error: "Preset not found" }, 404);
      }

      const story = await createStory(userId, { bookId, templateId, presetId }, openingBeat, premise);
      return c.json({ story: { id: story.id } }, 201);
    } catch (err) {
      logger.error({ err, userId }, "Failed to create story");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  app.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const storyId = Number(c.req.param("id"));
    try {
      const story = await getStory(user.id, storyId);
      if (!story) return c.json({ error: "Story not found" }, 404);
      return c.json({ story });
    } catch (err) {
      logger.error({ err, userId: user.id, storyId }, "Failed to load story");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  app.patch("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const storyId = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as { title?: unknown };
    if (typeof body.title !== "string") return c.json({ error: "title must be a string" }, 400);
    try {
      const result = await renameStory(user.id, storyId, body.title.slice(0, 100));
      if (!result) return c.json({ error: "Story not found" }, 404);
      return c.json({ title: result.title });
    } catch (err) {
      logger.error({ err, userId: user.id, storyId }, "Failed to rename story");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  app.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const storyId = Number(c.req.param("id"));
    try {
      const deleted = await deleteStory(user.id, storyId);
      if (!deleted) return c.json({ error: "Story not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      logger.error({ err, userId: user.id, storyId }, "Failed to delete story");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // ─── Ведение истории ──────────────────────────────────────────────────────
  app.post("/:id/advance", handleAdvanceStory);
  app.post("/:id/messages/:msgId/regenerate", handleRegenerateStoryBeat);
  app.post("/:id/messages/:msgId/branch", handleSwitchStoryBranch);
  app.delete("/:id/messages/:msgId", handleDeleteStoryMessage);

  return app;
}
