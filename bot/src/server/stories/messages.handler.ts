import { streamSSE } from "hono/streaming";
import {
  findNewestStoryChild,
  getStory,
  getStoryMessage,
  insertStoryMessage,
  setActiveStoryMessage,
  updateActiveStoryMessage,
  updateStoryBeatContent,
  deleteStoryMessage,
} from "../../db/stories/index.js";
import logger from "../../logger.js";
import { streamCompletion, writeGenerationError } from "../shared/streamGeneration.js";
import { buildStoryCompletionInput } from "./storyContext.js";
import type { Ctx } from "./stories.types.js";

/**
 * POST /:id/messages/:msgId/regenerate — перегенерирует бит как нового сиблинга под тем же user-ходом
 * (та же директива переприменяется автоматически). Корневой openingBeat регенерировать нельзя.
 */
export async function handleRegenerateStoryBeat(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const story = await getStory(userId, storyId);
  if (!story) return c.json({ error: "Story not found" }, 404);

  const beat = await getStoryMessage(userId, msgId);
  if (!beat || beat.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);
  if (beat.role !== "assistant") return c.json({ error: "Can only regenerate a beat" }, 400);
  if (beat.parentId == null) return c.json({ error: "Cannot regenerate the opening beat" }, 400);

  const steerId = beat.parentId;
  // Курсор на родительский user-ход (живой триггер) — путь закончится на нём, как нужно builder'у.
  await setActiveStoryMessage(storyId, steerId);

  const input = await buildStoryCompletionInput(userId, storyId);
  if (!input) return c.json({ error: "Story not found" }, 404);

  return streamSSE(c, async (stream) => {
    try {
      const result = await streamCompletion(stream, {
        messages: input.msgs,
        ...input.samplingOpts,
        userId,
        debugLabel: "narrator",
      });
      const newBeat = await insertStoryMessage(userId, storyId, steerId, "assistant", "beat", result.content);
      await updateActiveStoryMessage(storyId, newBeat.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(newBeat) });
    } catch (err) {
      logger.error({ err, userId, storyId }, "regenerateStoryBeat stream error");
      // Возвращаем курсор на исходный бит, чтобы история не «откатилась» к user-ходу.
      await updateActiveStoryMessage(storyId, beat.id).catch((rollbackErr) =>
        logger.error({ err: rollbackErr, userId, storyId, beatId: beat.id }, "Failed to restore story cursor after regenerate"),
      );
      await writeGenerationError(stream, err);
    }
  });
}

/**
 * POST /:id/messages/:msgId/branch — переключает активную ветку. По биту фиксируем курсор ровно
 * на узле (можно ответвиться отсюда — как в RP-графе). По user-ходу (директива/«Дальше») курсор
 * ставить нельзя: это эфемерный триггер, история обязана заканчиваться битом (тот же инвариант,
 * что чинит pruneOrphanSteers при удалении) — спускаемся к его биту-листу. В ленте по стрелкам
 * переключают только биты, поэтому развилка важна лишь для клика по узлу в графе.
 */
export async function handleSwitchStoryBranch(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);

    if (msg.kind === "beat") {
      await setActiveStoryMessage(storyId, msgId);
    } else {
      // Директива/«Дальше» — эфемерный триггер, курсор на него ставить нельзя. Встаём ровно на ЕГО
      // бит (самого свежего прямого ребёнка), а НЕ спускаемся к самому глубокому листу — иначе клик
      // по узлу в середине дерева увёл бы в конец истории, и ответвиться из середины было бы нельзя.
      // Ребёнок директивы всегда бит (строгое чередование). Висячая директива без бита (легаси/
      // середина генерации) — откатываемся на родительский бит (parentId у user-хода всегда бит).
      const beatId = (await findNewestStoryChild(storyId, msgId)) ?? msg.parentId;
      await setActiveStoryMessage(storyId, beatId);
    }
    return c.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to switch story branch");
    return c.json({ error: "Internal error" }, 500);
  }
}

/**
 * POST /:id/messages/:msgId/edit — правит текст бита на месте (любого, включая openingBeat):
 * без обращения к ИИ, без нового сиблинга — просто перезаписывает content и сбрасывает кэш
 * перевода (см. updateStoryBeatContent). Директивы (role="user") этим путём не редактируются.
 */
export async function handleEditStoryBeat(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const body = (await c.req.json().catch(() => ({}))) as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return c.json({ error: "content is required" }, 400);

  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);
    if (msg.role !== "assistant" || msg.kind !== "beat") {
      return c.json({ error: "Can only edit a beat" }, 400);
    }

    const updated = await updateStoryBeatContent(userId, storyId, msgId, content);
    if (!updated) return c.json({ error: "Message not found" }, 404);
    return c.json({ content: updated.content, translations: updated.translations });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to edit story beat");
    return c.json({ error: "Internal error" }, 500);
  }
}

/** DELETE /:id/messages/:msgId — удаляет сообщение и поддерево (корневой openingBeat удалять нельзя). */
export async function handleDeleteStoryMessage(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);
    if (msg.parentId == null) return c.json({ error: "Cannot delete the opening beat" }, 400);

    const deleted = await deleteStoryMessage(userId, storyId, msgId);
    if (!deleted) return c.json({ error: "Message not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to delete story message");
    return c.json({ error: "Internal error" }, 500);
  }
}
