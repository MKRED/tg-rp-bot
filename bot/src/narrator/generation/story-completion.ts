import type { StoryDetail, StorySettings } from "@tg-rp-bot/shared";
import type { GenerationPreset, NarratorTemplate, StoryPromptOrderItem } from "../../db/schema.js";
import type { PromptEntry } from "../../knowledge-books/entries/entries-prompt.repository.js";
import type { ChatMessage } from "../../llm/types.js";
import { matchesTriggerKeywords } from "../../prompt/keywordMatch.js";
import type { TrimInfo } from "../../prompt/budget.js";
import { presetToCompletionOptions } from "../../prompt/promptBuilder/index.js";
import {
  buildStoryMessages,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_NARRATOR_TEMPLATE,
  resolveNarratorMarkers,
} from "../../prompt/storyPromptBuilder/index.js";
import { normalizeStoryPromptOrder } from "../../prompt/storyPromptOrder.js";
import type { CompactionRow } from "../compaction/compactions.repository.js";
import { splitByCompactions } from "../compaction/live-tail.js";

/**
 * История + всё, из чего собирается запрос к LLM. template — источник промптов, preset — сэмплинг и
 * окно контекста; отсутствие любого не валит генерацию (дефолтный шаблон / без лимита).
 * compactions — все пересказы истории (валидную цепочку активного пути выбирает сборщик).
 */
export type StoryContext = {
  story: StoryDetail;
  template: NarratorTemplate | null;
  preset: GenerationPreset | null;
  settings: StorySettings;
  compactions: CompactionRow[];
  entries: PromptEntry[];
};

/** Сэмплинг пресета для chatCompletion; без пресета — пусто (дефолты провайдера). */
export type SamplingOptions = Partial<ReturnType<typeof presetToCompletionOptions>>;

/** Порядок компонентов шаблона; старые шаблоны без `compact` дополняются на дефолтную позицию. */
export function storyPromptOrder(template: NarratorTemplate | null): StoryPromptOrderItem[] {
  return template ? normalizeStoryPromptOrder(template.promptOrder) : DEFAULT_NARRATOR_PROMPT_ORDER;
}

/** Мастер-гейт сжатия в шаблоне: включён ли компонент `compact` в порядке промптов. */
export function compactComponentOn(promptOrder: StoryPromptOrderItem[]): boolean {
  return promptOrder.some((i) => i.id === "compact" && i.enabled);
}

/**
 * Книга знаний: always_on — всегда; keyword — если одно из триггер-слов встретилось среди последних
 * keywordDepth сообщений АКТИВНОГО ПУТИ (а не урезанной под бюджет истории): лорбук должен донести
 * факт, даже если само сообщение-триггер потом не поместилось в промпт.
 */
export function selectLorebook(entries: PromptEntry[], pathContents: string[]): string[] {
  return entries
    .filter(
      (e) => e.activation === "always_on" || matchesTriggerKeywords(pathContents.slice(-e.keywordDepth).join("\n"), e.keywords),
    )
    .map((e) => e.text)
    .filter((t) => t.trim());
}

/**
 * Запрос к LLM для narrator-генерации из текущего состояния истории. Курсор истории на момент
 * загрузки контекста должен стоять на живом user-ходе (триггере). trim:false — история целиком
 * (статистика/сжатие считают «желаемый» объём); compactComponentEnabled — для гейтов сжатия.
 */
export function buildStoryCompletion(
  ctx: StoryContext,
  opts: { trim?: boolean; onTrim?: (info: TrimInfo) => void } = {},
): { msgs: ChatMessage[]; samplingOpts: SamplingOptions; compactComponentEnabled: boolean } {
  const { story, template, preset, settings } = ctx;
  const promptOrder = storyPromptOrder(template);
  const compactEnabled = compactComponentOn(promptOrder);
  const { continueMarker, leadingUserMarker } = resolveNarratorMarkers(template);

  // Пересказы подставляются, только если включены и компонент шаблона, и сжатие в настройках истории;
  // иначе history — весь активный путь.
  let compactSummaries: string[] = [];
  let history = story.messages;
  if (compactEnabled && settings.compactEnabled && story.activeMessageId != null) {
    const { chain, liveTail } = splitByCompactions(story.messages, ctx.compactions);
    compactSummaries = chain.map((c) => c.summary);
    history = liveTail;
  }

  const msgs = buildStoryMessages({
    systemPrompt: template?.systemPrompt.trim() ? template.systemPrompt : DEFAULT_NARRATOR_TEMPLATE,
    auxiliarySystemPrompt: template?.auxiliarySystemPrompt ?? "",
    postHistoryInstruction: template?.postHistoryInstruction ?? "",
    premise: story.premise,
    lorebook: selectLorebook(ctx.entries, story.messages.map((m) => m.content)),
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
    onTrim: opts.onTrim,
  });
  return { msgs, samplingOpts: preset ? presetToCompletionOptions(preset) : {}, compactComponentEnabled: compactEnabled };
}
