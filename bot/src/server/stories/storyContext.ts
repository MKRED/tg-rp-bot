import { NotFoundException } from "@nestjs/common";
import { loadStoryContext } from "../../db/stories/index.js";
import logger from "../../logger.js";
import { buildStoryCompletion } from "../../narrator/generation/story-completion.js";

/**
 * Вход для narrator-генерации из текущего состояния истории (сборка — narrator/generation/
 * story-completion.ts, общая с Nest). Курсор истории на момент вызова должен стоять на живом
 * user-ходе (триггере). opts.trim = false — история целиком («желаемый» объём для гейтов сжатия).
 * null — истории нет у пользователя.
 */
export async function buildStoryCompletionInput(userId: number, storyId: number, opts: { trim?: boolean } = {}) {
  const ctx = await loadStoryContext(userId, storyId).catch((err: unknown) => {
    if (err instanceof NotFoundException) return null;
    throw err;
  });
  if (!ctx) return null;
  const { msgs, samplingOpts, compactComponentEnabled } = buildStoryCompletion(ctx, {
    trim: opts.trim,
    onTrim: ({ dropped, kept, total }) =>
      logger.info({ userId, storyId, dropped, kept, total }, "Story history trimmed to context budget"),
  });
  return { msgs, samplingOpts, preset: ctx.preset, compactComponentEnabled };
}
