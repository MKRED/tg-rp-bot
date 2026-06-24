import type { StoryMessageInPath } from "../db/stories/index.js";
import type { ChatMessage } from "../llm/types.js";
import { countTokens } from "../utils/index.js";
import { trimHistoryToBudget, type TrimInfo } from "./promptBuilder.js";

/** Резерв токенов под ответ модели, когда maxTokens не задан. */
const DEFAULT_OUTPUT_RESERVE = 512;
/** Надбавка на одно сообщение (роль/служебная разметка чат-формата). */
const PER_MESSAGE_OVERHEAD = 4;

/**
 * Маркер-триггер «продолжай»: им же нейтрализуются ОТЫГРАННЫЕ user-ходы (директивы/continue) при
 * сборке контекста — их последствие уже живёт в тексте последующего бита, повторно инструктировать
 * не нужно. На английском намеренно (модель продолжает на языке истории независимо от маркера).
 */
export const CONTINUE_MARKER = "Continue the story.";
/**
 * Синтетический leading-user перед корнем (openingBeat — assistant). Без него массив сообщений
 * начинался бы с assistant, что отвергают Anthropic (через OpenRouter) и reasoner DeepSeek.
 */
export const LEADING_USER_MARKER = "Begin the story.";

/**
 * Дефолтная нарратор-инструкция (system) — используется, когда у истории не выбран narrator-шаблон
 * или его systemPrompt пуст. Также годится как заготовка для сидирования новых шаблонов.
 */
export const DEFAULT_NARRATOR_TEMPLATE = `You are the narrator of an unfolding, collaborative story. Drive the scene forward as an omniscient storyteller: describe the setting, events, and the words and actions of ALL characters. The user is the director, not a character — never write or speak for the user.

When the latest user message contains a directive (an out-of-character instruction such as introducing an event or twist), weave it naturally into the story over the next beat — do not quote it or address it directly.

Write one cohesive beat per turn: vivid but focused. End on a natural pause or a hook rather than resolving everything at once.`;

export type StoryPromptOptions = {
  /** Нарратор-инструкция (systemPrompt шаблона или дефолт). */
  systemPrompt: string;
  /** Инструкция «после истории» из шаблона (задел; в MVP уходит в системный блок). */
  postHistoryInstruction: string;
  /** Системная вводная истории (опц.). */
  premise: string;
  /** Тексты always_on-записей книги знаний (уже отфильтрованы и резолвнуты). */
  lorebook: string[];
  /** Активный путь истории; последний узел — живой триггер (user-ход текущей генерации). */
  history: StoryMessageInPath[];
  contextUnlimited?: boolean;
  contextSize?: number | null;
  maxTokens?: number | null;
  onTrim?: (info: TrimInfo) => void;
};

/** Системные блоки запроса (нарратор-инструкция + премиза + книга знаний + post-history). */
function systemBlocks(opts: StoryPromptOptions): string[] {
  const blocks: string[] = [];
  if (opts.systemPrompt.trim()) blocks.push(opts.systemPrompt);
  if (opts.premise.trim()) blocks.push(`Story premise:\n${opts.premise}`);
  if (opts.lorebook.length > 0) {
    blocks.push(`World and characters:\n\n${opts.lorebook.join("\n\n")}`);
  }
  if (opts.postHistoryInstruction.trim()) blocks.push(opts.postHistoryInstruction);
  return blocks;
}

/** Урезает активный путь под лимит контекста (оставляя самые свежие узлы, включая живой триггер). */
function resolveHistory(opts: StoryPromptOptions, fixedSystemTokens: number): StoryMessageInPath[] {
  if (opts.contextUnlimited || opts.contextSize == null) return opts.history;

  const reserve = opts.maxTokens ?? DEFAULT_OUTPUT_RESERVE;
  const fixed = fixedSystemTokens + countTokens(LEADING_USER_MARKER) + PER_MESSAGE_OVERHEAD;
  const available = opts.contextSize - reserve - fixed;
  const trimmed = trimHistoryToBudget(
    opts.history,
    available,
    (m) => countTokens(m.content) + PER_MESSAGE_OVERHEAD,
  );
  const dropped = opts.history.length - trimmed.length;
  if (dropped > 0) opts.onTrim?.({ dropped, kept: trimmed.length, total: opts.history.length });
  return trimmed;
}

/**
 * Собирает ChatMessage[] для narrator-генерации:
 *   - системные блоки (нарратор-инструкция + премиза + книга знаний + post-history) → role:"system";
 *   - синтетический leading-user (массив не должен начинаться с assistant);
 *   - активный путь: assistant-биты как есть; user-ходы (continue/directive) НЕЙТРАЛИЗУЮТСЯ в
 *     CONTINUE_MARKER, КРОМЕ последнего (живого триггера) — он сохраняет свой текст.
 * Чистая функция (только countTokens) — тестируется юнит-тестом.
 */
export function buildStoryMessages(opts: StoryPromptOptions): ChatMessage[] {
  const blocks = systemBlocks(opts);
  const fixedSystemTokens = blocks.reduce(
    (sum, b) => sum + countTokens(b) + PER_MESSAGE_OVERHEAD,
    0,
  );

  const history = resolveHistory(opts, fixedSystemTokens);
  const lastIndex = history.length - 1;

  const result: ChatMessage[] = [];
  for (const block of blocks) result.push({ role: "system", content: block });
  // Примечание: при агрессивной обрезке первым уцелевшим узлом может оказаться нейтрализованный
  // user-ход — тогда после leading-user идут два user-сообщения подряд. Anthropic/OpenRouter их
  // склеивают, так что это не нарушает чередование; специально схлопывать не нужно.
  result.push({ role: "user", content: LEADING_USER_MARKER });

  history.forEach((m, i) => {
    if (m.role === "user" && i !== lastIndex) {
      // Отыгранный user-ход → нейтрализуем (последствие уже в следующем бите).
      result.push({ role: "user", content: CONTINUE_MARKER });
    } else {
      result.push({ role: m.role, content: m.content });
    }
  });

  return result;
}
