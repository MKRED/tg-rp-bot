import type { StoryPromptComponentId } from "../../db/schema.js";
import type { StoryMessageInPath } from "../../db/stories/index.js";
import type { ChatMessage } from "../../llm/types.js";
import { countTokens } from "../../utils/index.js";
import { DEFAULT_OUTPUT_RESERVE, PER_MESSAGE_OVERHEAD, trimHistoryToBudget } from "./budget.js";
import {
  CONTINUE_MARKER,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  LEADING_USER_MARKER,
} from "./storyPromptBuilder.constants.js";
import type { StoryPromptOptions } from "./storyPromptBuilder.types.js";

// Реэкспорт публичной поверхности билдера для потребителей (storyHandlers/narrator-templates).
export {
  CONTINUE_MARKER,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_NARRATOR_TEMPLATE,
  LEADING_USER_MARKER,
} from "./storyPromptBuilder.constants.js";
export type { StoryPromptOptions } from "./storyPromptBuilder.types.js";

/** Текст non-history компонента запроса (с обёрткой, если нужна) или null, если он пуст. */
function componentText(
  opts: StoryPromptOptions,
  id: Exclude<StoryPromptComponentId, "history">,
): string | null {
  switch (id) {
    case "system":
      return opts.systemPrompt.trim() ? opts.systemPrompt : null;
    case "premise":
      return opts.premise.trim() ? `Story premise:\n${opts.premise}` : null;
    case "lorebook":
      return opts.lorebook.length > 0 ? `World and characters:\n\n${opts.lorebook.join("\n\n")}` : null;
    case "auxiliary":
      return opts.auxiliarySystemPrompt.trim() ? opts.auxiliarySystemPrompt : null;
    case "postHistory":
      return opts.postHistoryInstruction.trim() ? opts.postHistoryInstruction : null;
  }
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
 * Собирает ChatMessage[] для narrator-генерации. Порядок частей задаётся opts.promptOrder;
 * выключенные и пустые компоненты пропускаются.
 *   - все non-history компоненты (system / premise / lorebook / auxiliary / postHistory) → role:"system",
 *     отдельным сообщением;
 *   - history → синтетический leading-user (массив не должен начинаться с assistant) + активный путь:
 *     assistant-биты как есть; user-ходы (continue/directive) НЕЙТРАЛИЗУЮТСЯ в CONTINUE_MARKER, КРОМЕ
 *     последнего (живого триггера) — он сохраняет свой текст.
 * Чистая функция (только countTokens) — тестируется юнит-тестом.
 */
export function buildStoryMessages(opts: StoryPromptOptions): ChatMessage[] {
  // Стоимость фиксированных (non-history) частей — их урезать нельзя, вычитаем из бюджета истории.
  let fixedSystemTokens = 0;
  for (const item of opts.promptOrder) {
    if (!item.enabled || item.id === "history") continue;
    const text = componentText(opts, item.id);
    if (text) fixedSystemTokens += countTokens(text) + PER_MESSAGE_OVERHEAD;
  }

  // История эмитируется (и расходует бюджет) только если компонент включён в порядке. Если выключен —
  // обрезку не считаем, leading-user не резервируем (его стоимость учитывается внутри resolveHistory).
  const historyEnabled = opts.promptOrder.some((i) => i.id === "history" && i.enabled);
  const history = historyEnabled ? resolveHistory(opts, fixedSystemTokens) : [];
  const lastIndex = history.length - 1;

  const result: ChatMessage[] = [];
  for (const item of opts.promptOrder) {
    if (!item.enabled) continue;

    if (item.id === "history") {
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
      continue;
    }

    const text = componentText(opts, item.id);
    if (text) result.push({ role: "system", content: text });
  }

  return result;
}
