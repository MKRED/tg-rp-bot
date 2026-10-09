import { streamSSE } from "hono/streaming";
import {
  getStory,
  getStoryMessage,
  insertStoryMessage,
  setActiveStoryMessage,
  updateActiveStoryMessage,
} from "../../db/stories/index.js";
import logger from "../../logger.js";
import { streamCompletion, writeGenerationError } from "../../common/stream-completion.js";
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

  const beat = await getStoryMessage(userId, storyId, msgId);
  if (!beat) return c.json({ error: "Message not found" }, 404);
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
