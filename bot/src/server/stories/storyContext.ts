import { getActiveEntriesForPrompt } from "../../db/knowledge/index.js";
import { getNarratorTemplate } from "../../db/narratorTemplates/index.js";
import { getPreset } from "../../db/presets/index.js";
import { getStory, getStorySettings, listCompactions } from "../../db/stories/index.js";
import logger from "../../logger.js";
import { selectValidChain } from "../prompt/compactionPlan.js";
import { matchesTriggerKeywords } from "../prompt/keywordMatch.js";
import { presetToCompletionOptions } from "../prompt/promptBuilder/index.js";
import {
  buildStoryMessages,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_NARRATOR_TEMPLATE,
  resolveNarratorMarkers,
} from "../prompt/storyPromptBuilder/index.js";
import { normalizeStoryPromptOrder } from "../prompt/storyPromptOrder.js";

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
  const { continueMarker, leadingUserMarker } = resolveNarratorMarkers(template);
  // Нормализуем порядок (старые шаблоны без `compact` дополняются на дефолтную позицию).
  const promptOrder = template
    ? normalizeStoryPromptOrder(template.promptOrder)
    : DEFAULT_NARRATOR_PROMPT_ORDER;

  const preset = story.preset ? await getPreset(userId, story.preset.id) : null;

  // Книга знаний: always_on идёт в промпт всегда; keyword — только если одно из её триггер-слов
  // встретилось среди последних keywordDepth сообщений АКТИВНОГО ПУТИ (story.messages, а не урезанной
  // под токен-бюджет history ниже) — это намеренно: лорбук должен донести факт, даже если само
  // сообщение-триггер потом не поместилось в бюджет и не попадёт в отправленный модели промпт.
  const entries = await getActiveEntriesForPrompt(userId, story.book.id);
  const historyContents = story.messages.map((m) => m.content);
  const lorebook = entries
    .filter(
      (e) =>
        e.activation === "always_on" ||
        matchesTriggerKeywords(historyContents.slice(-e.keywordDepth).join("\n"), e.keywords),
    )
    .map((e) => e.text)
    .filter((t) => t.trim());

  // Применение пересказов (compact). Гейт: компонент `compact` шаблона включён И compactEnabled чата.
  // При выключенном любом — пересказы не подставляются, history = весь активный путь (как до фичи).
  const settings = await getStorySettings(storyId);
  const compactComponentOn = promptOrder.some((i) => i.id === "compact" && i.enabled);
  let compactSummaries: string[] = [];
  let history = story.messages;
  if (compactComponentOn && settings.compactEnabled && story.activeMessageId != null) {
    const pathIds = new Set(story.messages.map((m) => m.id));
    const chain = selectValidChain(await listCompactions(userId, storyId), pathIds);
    if (chain.length > 0) {
      compactSummaries = chain.map((c) => c.summary);
      const lastAnchorId = chain[chain.length - 1]!.toAnchorId;
      const anchorIdx = story.messages.findIndex((m) => m.id === lastAnchorId);
      // Живой хвост = сообщения пути после последнего якоря.
      if (anchorIdx >= 0) history = story.messages.slice(anchorIdx + 1);
    }
  }

  const msgs = buildStoryMessages({
    systemPrompt,
    auxiliarySystemPrompt,
    postHistoryInstruction,
    premise: story.premise,
    lorebook,
    compactSummaries,
    promptOrder,
    mergeSystemPrompts: template?.mergeSystemPrompts ?? false,
    history,
    continueMarker,
    leadingUserMarker,
    contextUnlimited: preset?.contextUnlimited,
    contextSize: preset?.contextSize,
    maxTokens: preset?.maxTokens,
    trim: opts.trim,
    onTrim: ({ dropped, kept, total }) =>
      logger.info({ userId, storyId, dropped, kept, total }, "Story history trimmed to context budget"),
  });

  const samplingOpts = preset ? presetToCompletionOptions(preset) : {};
  // compactComponentEnabled — включён ли компонент `compact` в шаблоне (мастер-гейт фичи), нужен
  // экрану статистики и авто-триггеру, чтобы не загружать шаблон повторно.
  return { msgs, samplingOpts, preset, compactComponentEnabled: compactComponentOn };
}
