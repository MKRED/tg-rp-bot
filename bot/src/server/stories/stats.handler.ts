import { getStoryTokenStats } from "../../db/stories/index.js";
import logger from "../../logger.js";
import { countTokens } from "../../utils/index.js";
import { compactUnavailableReason } from "./compact.gate.js";
import { buildStoryCompletionInput } from "./storyContext.js";
import type { Ctx } from "./stories.types.js";

/**
 * GET /:id/stats — статистика истории для экрана настроек (зеркало handleChatStats):
 *   tokensTotal        — токены сообщений во всех ветках дерева,
 *   tokensActiveBranch — токены сообщений активной ветки,
 *   tokensPrompt       — полный запрос к LLM по активной ветке (система + премиза + книга +
 *                        aux + история + post-history), ровно как его собирает buildStoryMessages,
 *   contextLimit       — лимит контекста из пресета (null = безграничный/не задан).
 * Impersonate-вариантов в narrator нет — соответствующего поля в ответе тоже нет.
 */
export async function handleStoryStats(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));

  try {
    // trim:false — намеренно НЕ урезаем историю: бар должен показать «желаемый» объём, чтобы
    // пользователь видел переполнение окна (used > limit → красный), хотя генерация историю урежет.
    const input = await buildStoryCompletionInput(userId, storyId, { trim: false });
    if (!input) return c.json({ error: "Story not found" }, 404);

    // Только токены контента (без PER_MESSAGE_OVERHEAD бюджета обрезки): бар показывает «вес» текста.
    const tokensPrompt = input.msgs.reduce((sum, m) => sum + countTokens(m.content), 0);

    // Лимит контекста как знаменатель полосы: безграничный/незаданный → null (полоса покажет «∞»).
    const contextLimit = input.preset?.contextUnlimited ? null : (input.preset?.contextSize ?? null);

    // Доступность сжатия (для гейта секции в настройках): причина недоступности по пресету +
    // включён ли компонент `compact` в шаблоне. compactAvailable требует обоих.
    const reason = compactUnavailableReason(input.preset);
    const compactAvailable = reason === null && input.compactComponentEnabled;
    const compactReason = !input.compactComponentEnabled && reason === null ? "template_off" : reason;

    const tokens = await getStoryTokenStats(userId, storyId);

    return c.json({
      stats: {
        ...tokens,
        tokensPrompt,
        contextLimit,
        compactAvailable,
        compactReason,
        templateCompactEnabled: input.compactComponentEnabled,
      },
    });
  } catch (err) {
    logger.error({ err, userId, storyId }, "Failed to compute story stats");
    return c.json({ error: "Internal error" }, 500);
  }
}
