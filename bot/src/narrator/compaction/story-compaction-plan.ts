import type { StoryMessage } from "@tg-rp-bot/shared";
import type { NarratorTemplate } from "../../db/schema.js";
import type { ChatMessage } from "../../llm/types.js";
import { PER_MESSAGE_OVERHEAD } from "../../prompt/budget.js";
import { planCompactionSegments } from "../../prompt/compactionPlan.js";
import { COMPACTION_CONTEXT_HEADER, DEFAULT_COMPACTION_PROMPT, resolveNarratorMarkers } from "../../prompt/storyPromptBuilder/index.js";
import { countTokens } from "../../utils/index.js";
import type { StoryContext } from "../generation/story-completion.js";
import { compactAvailable, resolveCompactFloor } from "./compact-gate.js";
import type { CompactionRow } from "./compactions.repository.js";
import { splitByCompactions } from "./live-tail.js";

/** Почему сжатие сейчас невозможно (тело 409 POST /compact); null — можно сжимать. */
export type CompactBlockReason = "unavailable" | "gate_off" | "no_active";

/** Полный вход запроса в токенах — тем же токенайзером и с тем же overhead, что бюджет обрезки. */
export function promptTokens(msgs: ChatMessage[]): number {
  return msgs.reduce((sum, m) => sum + countTokens(m.content) + PER_MESSAGE_OVERHEAD, 0);
}

/**
 * Проверки по порядку Hono: пресет без подходящего окна → unavailable; выключен компонент `compact`
 * в шаблоне или сжатие в настройках → gate_off; нет курсора → no_active.
 */
export function compactBlockReason(ctx: StoryContext, compactComponentEnabled: boolean): CompactBlockReason | null {
  if (!compactAvailable(ctx.preset)) return "unavailable";
  if (!compactComponentEnabled || !ctx.settings.compactEnabled) return "gate_off";
  if (ctx.story.activeMessageId == null) return "no_active";
  return null;
}

/**
 * Нужно ли авто-сжатие перед битом: включены оба гейта и авто, фича доступна, и полный вход (с уже
 * применёнными пересказами, без обрезки) достиг окна контекста.
 */
export function needsAutoCompaction(ctx: StoryContext, untrimmed: ChatMessage[], compactComponentEnabled: boolean): boolean {
  const { settings, preset } = ctx;
  if (!settings.compactEnabled || !settings.compactAutoEnabled || !compactComponentEnabled) return false;
  if (!compactAvailable(preset)) return false;
  return promptTokens(untrimmed) >= preset!.contextSize!;
}

/** Один пересказ: какие сообщения хвоста он покрывает и что уходит в LLM. */
export type CompactionSegment = {
  /** Последнее сообщение сегмента — всегда бит (якорь toAnchorId). */
  anchorId: number;
  /** Только биты: директивы и «Дальше» уже вплетены в их повествование. */
  beatTexts: string[];
  /** Весь диапазон (вкл. директивы) — из живой истории уходят все эти сообщения. */
  coveredCount: number;
  coveredTokens: number;
};

export type CompactionPlan = { floor: number; chain: CompactionRow[]; segments: CompactionSegment[] };

/**
 * План одного прохода сжатия (вызывать, когда compactBlockReason вернул null): живой хвост режется на
 * сегменты по ~contextSize−floor токенов, чтобы общий вход упал до floor. Стоимость сообщения хвоста —
 * КАК В ПРОМПТЕ: отыгранные user-ходы нейтрализуются в continueMarker шаблона (кроме последнего), иначе
 * бюджет разъедется с фактическим запросом. План считается по состоянию до сжатия — токены новых
 * пересказов в floor не заложены (предохранитель — обрезка истории при генерации).
 */
export function planStoryCompaction(ctx: StoryContext, untrimmed: ChatMessage[]): CompactionPlan {
  const preset = ctx.preset!;
  const contextSize = preset.contextSize!;
  const floor = resolveCompactFloor(ctx.settings.compactFloorTokens, contextSize, preset.maxTokens);
  const segmentSize = Math.max(1, contextSize - floor);
  const { chain, liveTail } = splitByCompactions(ctx.story.messages, ctx.compactions);

  const { continueMarker } = resolveNarratorMarkers(ctx.template);
  const lastIdx = liveTail.length - 1;
  const tokensOf = (m: StoryMessage, i: number) =>
    (m.role === "user" && i !== lastIdx ? countTokens(continueMarker) : countTokens(m.content)) + PER_MESSAGE_OVERHEAD;
  const tailItems = liveTail.map((m, i) => ({ isBeat: m.kind === "beat", tokens: tokensOf(m, i) }));
  // Всё вне хвоста: system-блоки, уже существующие пересказы, leading-user.
  const overhead = promptTokens(untrimmed) - tailItems.reduce((s, t) => s + t.tokens, 0);
  // Последний пересказ уже вбит в overhead и дальше не сжимается — не повод для нового сжатия.
  const lastRecapWeight = chain.length > 0 ? countTokens(chain.at(-1)!.summary) : 0;

  const segments = planCompactionSegments(tailItems, overhead, floor, segmentSize, lastRecapWeight).map((seg) => ({
    anchorId: liveTail[seg.at(-1)!]!.id,
    beatTexts: seg.map((i) => liveTail[i]!).filter((m) => m.kind === "beat").map((m) => m.content),
    coveredCount: seg.length,
    coveredTokens: seg.reduce((s, i) => s + tailItems[i]!.tokens, 0),
  }));
  return { floor, chain, segments };
}

/** Промпт сжатия из шаблона (или дефолт) с подставленным числом слов пересказа. */
export function compactionPrompt(template: NarratorTemplate | null, words: number): string {
  return (template?.compactionPrompt.trim() || DEFAULT_COMPACTION_PROMPT).replaceAll("{{words}}", String(words));
}

/** Запрос на пересказ сегмента: инструкция, прошлые пересказы как «story so far», тексты битов. */
export function compactionRequest(prompt: string, priorSummaries: string[], beatTexts: string[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: prompt }];
  if (priorSummaries.length > 0) {
    messages.push({ role: "system", content: `${COMPACTION_CONTEXT_HEADER}\n\n${priorSummaries.join("\n\n")}` });
  }
  messages.push({ role: "user", content: beatTexts.join("\n\n") });
  return messages;
}
