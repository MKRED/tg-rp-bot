import { streamSSE } from "hono/streaming";
import {
  deleteStoryMessage,
  getStory,
  insertStoryMessage,
  setActiveStoryMessage,
  updateActiveStoryMessage,
} from "../../db/stories/index.js";
import { getNarratorTemplate } from "../../db/narratorTemplates/index.js";
import logger from "../../logger.js";
import { resolveNarratorMarkers } from "../prompt/storyPromptBuilder/index.js";
import { streamCompletion, writeGenerationError } from "../shared/streamGeneration.js";
import { compactStory, shouldAutoCompact } from "./compact.handler.js";
import { buildStoryCompletionInput } from "./storyContext.js";
import type { Ctx } from "./stories.types.js";

/**
 * POST /:id/advance — двигает историю вперёд. body { directive?: string }:
 * непустая директива → user-ход kind="directive" с её текстом; пусто → kind="continue" (маркер).
 * Затем стримит следующий бит. «Дальше» и режиссёрская директива — один и тот же механизм.
 */
export async function handleAdvanceStory(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));

  const body = (await c.req.json().catch(() => ({}))) as { directive?: string };
  const directive = typeof body.directive === "string" ? body.directive.trim() : "";

  const story = await getStory(userId, storyId);
  if (!story) return c.json({ error: "Story not found" }, 404);
  const parentBeatId = story.activeMessageId;
  if (parentBeatId == null) return c.json({ error: "Story has no active beat" }, 400);

  const kind = directive ? "directive" : "continue";
  // Живой continue-триггер пишем маркером шаблона истории (не глобальным дефолтом) — иначе кастомный
  // continueMarker разъедется с тем, что реально сохраняется в сообщении при клике «Дальше».
  let content = directive;
  if (!content) {
    const template = story.template ? await getNarratorTemplate(userId, story.template.id) : null;
    content = resolveNarratorMarkers(template).continueMarker;
  }

  return streamSSE(c, async (stream) => {
    let steerId: number | null = null;
    try {
      // Эфемерный user-ход как ребёнок последнего бита; курсор ставим на него (живой триггер).
      const steer = await insertStoryMessage(userId, storyId, parentBeatId, "user", kind, content);
      steerId = steer.id;
      await setActiveStoryMessage(storyId, steer.id);
      await stream.writeSSE({ event: "userMessage", data: JSON.stringify(steer) });

      // Авто-сжатие перед битом: если вход достиг лимита контекста — синхронно сжимаем (статус в ленте),
      // затем генерируем уже на освобождённом контексте. Сжатие — оптимизация: ни проверка, ни само
      // сжатие НЕ роняют advance (генерация продолжится со штатной обрезкой trimHistoryToBudget).
      const auto = await shouldAutoCompact(userId, storyId).catch((err) => {
        logger.warn({ err, userId, storyId }, "Auto-compaction check failed; skipping");
        return false;
      });
      if (auto) {
        await stream.writeSSE({ event: "status", data: JSON.stringify({ phase: "compacting" }) });
        await compactStory(userId, storyId).catch((err) =>
          logger.error({ err, userId, storyId }, "Auto-compaction failed; proceeding with trim"),
        );
      }

      const input = await buildStoryCompletionInput(userId, storyId);
      if (!input) throw new Error("Failed to build story context");

      const result = await streamCompletion(stream, {
        messages: input.msgs,
        ...input.samplingOpts,
        userId,
        debugLabel: "narrator",
      });

      const beat = await insertStoryMessage(userId, storyId, steer.id, "assistant", "beat", result.content);
      await updateActiveStoryMessage(storyId, beat.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(beat) });
    } catch (err) {
      logger.error({ err, userId, storyId }, "advanceStory stream error");
      // Откат висящего user-хода без бита: удаляем его (курсор вернётся к родительскому биту).
      if (steerId != null) {
        await deleteStoryMessage(userId, storyId, steerId).catch((rollbackErr) =>
          logger.error({ err: rollbackErr, userId, storyId, steerId }, "Failed to roll back dangling story steer"),
        );
      }
      await writeGenerationError(stream, err);
    }
  });
}
