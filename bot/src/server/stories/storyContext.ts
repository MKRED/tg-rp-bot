import { getActiveEntriesForPrompt } from "../../db/knowledge/index.js";
import { getNarratorTemplate } from "../../db/narratorTemplates/index.js";
import { getPreset } from "../../db/presets/index.js";
import { getStory } from "../../db/stories/index.js";
import logger from "../../logger.js";
import { presetToCompletionOptions } from "../prompt/promptBuilder.js";
import {
  buildStoryMessages,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_NARRATOR_TEMPLATE,
} from "../prompt/storyPromptBuilder.js";

/**
 * Собирает вход для narrator-генерации из текущего состояния истории: системный промпт (из шаблона
 * или дефолт), премиза, always_on книги знаний и активный путь (с нейтрализацией внутри builder).
 * Курсор истории на момент вызова должен стоять на живом user-ходе (триггере).
 *
 * Переиспользуется генерацией (advance/regenerate) и экраном статистики. Для статистики
 * opts.trim = false — история берётся целиком, чтобы бар показал «желаемый» объём запроса.
 * Возвращает также preset, чтобы вызывающий вычислил лимит контекста для бара.
 */
export async function buildStoryCompletionInput(
  userId: number,
  storyId: number,
  opts: { trim?: boolean } = {},
) {
  const story = await getStory(userId, storyId);
  if (!story) return null;

  const template = story.template ? await getNarratorTemplate(userId, story.template.id) : null;
  const systemPrompt =
    template && template.systemPrompt.trim() ? template.systemPrompt : DEFAULT_NARRATOR_TEMPLATE;
  const auxiliarySystemPrompt = template?.auxiliarySystemPrompt ?? "";
  const postHistoryInstruction = template?.postHistoryInstruction ?? "";
  const promptOrder = template?.promptOrder ?? DEFAULT_NARRATOR_PROMPT_ORDER;

  const preset = story.preset ? await getPreset(userId, story.preset.id) : null;

  // Книга знаний: в MVP в промпт идут только always_on-записи (keyword — задел).
  const entries = await getActiveEntriesForPrompt(userId, story.book.id);
  const lorebook = entries
    .filter((e) => e.activation === "always_on")
    .map((e) => e.text)
    .filter((t) => t.trim());

  const msgs = buildStoryMessages({
    systemPrompt,
    auxiliarySystemPrompt,
    postHistoryInstruction,
    premise: story.premise,
    lorebook,
    promptOrder,
    history: story.messages,
    contextUnlimited: preset?.contextUnlimited,
    contextSize: preset?.contextSize,
    maxTokens: preset?.maxTokens,
    trim: opts.trim,
    onTrim: ({ dropped, kept, total }) =>
      logger.info({ userId, storyId, dropped, kept, total }, "Story history trimmed to context budget"),
  });

  const samplingOpts = preset ? presetToCompletionOptions(preset) : {};
  return { msgs, samplingOpts, preset };
}
