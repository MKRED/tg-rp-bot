import type { StoryPromptComponentId, StoryPromptOrderItem } from "../../../db/schema.js";
import type { StoryMessageInPath } from "../../../db/stories/index.js";
import type { ChatMessage } from "../../../llm/types.js";
import { countTokens } from "../../../utils/index.js";
import { DEFAULT_OUTPUT_RESERVE, PER_MESSAGE_OVERHEAD, trimHistoryToBudget } from "../budget.js";
import {
  COMPACT_SUMMARY_HEADER,
  CONTINUE_MARKER,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  LEADING_USER_MARKER,
} from "./storyPromptBuilder.constants.js";
import type { StoryPromptOptions } from "./storyPromptBuilder.types.js";

// Реэкспорт публичной поверхности билдера для потребителей (storyHandlers/narrator-templates).
export {
  COMPACT_SUMMARY_HEADER,
  COMPACTION_CONTEXT_HEADER,
  CONTINUE_MARKER,
  DEFAULT_COMPACTION_PROMPT,
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
    case "compact": {
      // Сжатые пересказы активной ветки одним блоком (хронологически). Пусто → компонент пропускается.
      const summaries = opts.compactSummaries ?? [];
      return summaries.length > 0 ? `${COMPACT_SUMMARY_HEADER}\n\n${summaries.join("\n\n")}` : null;
    }
    case "postHistory":
      return opts.postHistoryInstruction.trim() ? opts.postHistoryInstruction : null;
  }
}

/** Урезает активный путь под лимит контекста (оставляя самые свежие узлы, включая живой триггер). */
function resolveHistory(opts: StoryPromptOptions, fixedSystemTokens: number): StoryMessageInPath[] {
  if (opts.contextUnlimited || opts.contextSize == null) return opts.history;

  const reserve = opts.maxTokens ?? DEFAULT_OUTPUT_RESERVE;
  const fixed = fixedSystemTokens + countTokens(opts.leadingUserMarker) + PER_MESSAGE_OVERHEAD;
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
 * Резолвит маркеры (continue/leading-user) из шаблона с фолбэком на встроенный дефолт. Общий
 * резолвер для storyContext (эмиссия) и compact.handler (учёт бюджета сжатия) — оба места должны
 * видеть ОДИН и тот же маркер, иначе бюджет сжатия разъедется с фактическим промптом. Фолбэк —
 * защитный кейс (шаблон истории не резолвился); форма шаблона уже не допускает пустых значений.
 */
export function resolveNarratorMarkers(
  template: { continueMarker: string; leadingUserMarker: string } | null | undefined,
): { continueMarker: string; leadingUserMarker: string } {
  return {
    continueMarker: template?.continueMarker.trim() || CONTINUE_MARKER,
    leadingUserMarker: template?.leadingUserMarker.trim() || LEADING_USER_MARKER,
  };
}

/**
 * Собирает ChatMessage[] для narrator-генерации. Порядок частей задаётся opts.promptOrder;
 * выключенные и пустые компоненты пропускаются.
 *   - все non-history компоненты (system / premise / lorebook / auxiliary / postHistory) → role:"system",
 *     отдельным сообщением;
 *   - history → синтетический leading-user (массив не должен начинаться с assistant) + активный путь:
 *     assistant-биты как есть; user-ходы (continue/directive) НЕЙТРАЛИЗУЮТСЯ в CONTINUE_MARKER, КРОМЕ
 *     последнего (живого триггера) — он сохраняет свой текст.
 *   - opts.mergeSystemPrompts=true → все non-history компоненты, стоящие в promptOrder ДО history,
 *     схлопываются в одно system-сообщение; каждый блок обёрнут в `<componentId>…</componentId>`.
 *     Компоненты ПОСЛЕ history (напр. postHistory) не трогает — уходят как обычно, отдельным сообщением.
 * Чистая функция (только countTokens) — тестируется юнит-тестом.
 */
export function buildStoryMessages(opts: StoryPromptOptions): ChatMessage[] {
  const historyIdx = opts.promptOrder.findIndex((i) => i.id === "history");
  // history может отсутствовать в promptOrder (защитный кейс) — тогда всё считаем "до истории".
  const beforeItems = historyIdx === -1 ? opts.promptOrder : opts.promptOrder.slice(0, historyIdx);
  const afterItems = historyIdx === -1 ? [] : opts.promptOrder.slice(historyIdx + 1);
  const historyEnabled = historyIdx !== -1 && opts.promptOrder[historyIdx]!.enabled;

  const beforeTexts = beforeItems
    // slice() выше гарантирует, что "history" сюда не попадёт, но TS видит только StoryPromptComponentId —
    // явный фильтр по id сужает тип для componentText().
    .filter((i): i is StoryPromptOrderItem & { id: Exclude<StoryPromptComponentId, "history"> } =>
      i.enabled && i.id !== "history",
    )
    .map((i) => ({ id: i.id, text: componentText(opts, i.id) }))
    .filter((x): x is { id: Exclude<StoryPromptComponentId, "history">; text: string } => x.text != null);

  // Итоговые system-сообщения ДО history: при склейке — одно (теги + текст), иначе — по одному на компонент.
  // Считаем их именно в этом виде, а не по компонентам отдельно, чтобы бюджет истории ниже видел РЕАЛЬНОЕ
  // число сообщений и токенов тегов — иначе при включённой склейке бюджет разъехался бы с фактическим промптом.
  const preHistoryMessages: string[] = opts.mergeSystemPrompts
    ? beforeTexts.length > 0
      ? [beforeTexts.map(({ id, text }) => `<${id}>\n${text}\n</${id}>`).join("\n\n")]
      : []
    : beforeTexts.map(({ text }) => text);

  // Стоимость фиксированных (non-history) частей — их урезать нельзя, вычитаем из бюджета истории.
  const fixedSystemTokens = preHistoryMessages.reduce(
    (sum, text) => sum + countTokens(text) + PER_MESSAGE_OVERHEAD,
    0,
  );

  // trim:false (экран статистики) — берём историю целиком, без урезания под бюджет контекста.
  const trim = opts.trim ?? true;
  const history = historyEnabled
    ? trim
      ? resolveHistory(opts, fixedSystemTokens)
      : opts.history
    : [];
  const lastIndex = history.length - 1;

  const result: ChatMessage[] = preHistoryMessages.map((text) => ({ role: "system", content: text }));

  if (historyEnabled) {
    // Примечание: при агрессивной обрезке первым уцелевшим узлом может оказаться нейтрализованный
    // user-ход — тогда после leading-user идут два user-сообщения подряд. Anthropic/OpenRouter их
    // склеивают, так что это не нарушает чередование; специально схлопывать не нужно.
    result.push({ role: "user", content: opts.leadingUserMarker });
    history.forEach((m, i) => {
      if (m.role === "user" && i !== lastIndex) {
        // Отыгранный user-ход → нейтрализуем (последствие уже в следующем бите).
        result.push({ role: "user", content: opts.continueMarker });
      } else {
        result.push({ role: m.role, content: m.content });
      }
    });
  }

  // Компоненты ПОСЛЕ history (напр. postHistory) склейка не затрагивает — идут как обычно.
  for (const item of afterItems) {
    if (!item.enabled || item.id === "history") continue;
    const text = componentText(opts, item.id);
    if (text) result.push({ role: "system", content: text });
  }

  return result;
}
