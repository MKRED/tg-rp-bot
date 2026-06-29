import { and, eq } from "drizzle-orm";
import logger from "../../logger.js";
import { countTokens, decryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import { queryStoryActivePathIds } from "./queries.js";
import type { StoryTokenStats } from "./types.js";

/**
 * Считает объём истории в токенах: вся история (все ветки дерева) и активная ветка отдельно.
 * Content зашифрован per-user — расшифровываем, поэтому считать длину в SQL нельзя
 * (длина шифротекста ≠ длине открытого текста). Активную ветку выделяем по queryStoryActivePathIds.
 * Считаются только токены сообщений, без системных/нарратор-промптов. Зеркало getChatTokenStats.
 */
export async function getStoryTokenStats(
  userId: number,
  storyId: number,
): Promise<StoryTokenStats> {
  const t0 = Date.now();

  // Принадлежность + курсор активной ветки одним лёгким запросом.
  const storyRows = await db
    .select({ id: schema.storyChats.id, activeMessageId: schema.storyChats.activeMessageId })
    .from(schema.storyChats)
    .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)));
  const story = storyRows[0];
  if (!story) return { tokensTotal: 0, tokensActiveBranch: 0 };

  // queryStoryActivePathIds безопасна только для не-null курсора (история без курсора — ветки нет).
  const activePathIds = story.activeMessageId
    ? await queryStoryActivePathIds(story.activeMessageId)
    : new Set<number>();

  const rows = await db
    .select({ id: schema.storyMessages.id, content: schema.storyMessages.content })
    .from(schema.storyMessages)
    .where(eq(schema.storyMessages.storyChatId, storyId));

  const key = getUserEncryptionKey(userId);
  let tokensTotal = 0;
  let tokensActiveBranch = 0;
  for (const r of rows) {
    const tokens = countTokens(decryptField(r.content, key));
    tokensTotal += tokens;
    if (activePathIds.has(r.id)) tokensActiveBranch += tokens;
  }

  logger.debug(
    { durationMs: Date.now() - t0, userId, storyId, tokensTotal, tokensActiveBranch },
    "Story token stats computed",
  );
  return { tokensTotal, tokensActiveBranch };
}
