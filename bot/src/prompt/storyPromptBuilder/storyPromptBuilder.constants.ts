/**
 * Маркер-триггер «продолжай»: им же нейтрализуются ОТЫГРАННЫЕ user-ходы (директивы/continue) при
 * сборке контекста — их последствие уже живёт в тексте последующего бита, повторно инструктировать
 * не нужно. На английском намеренно (модель продолжает на языке истории независимо от маркера).
 */
export const CONTINUE_MARKER = "Continue the story.";

/**
 * Синтетический leading-user перед корнем (openingBeat — assistant). Без него массив сообщений
 * начинался бы с assistant, что отвергает reasoner DeepSeek.
 */
export const LEADING_USER_MARKER = "Begin the story.";

/**
 * Дефолтная нарратор-инструкция (system) — используется, когда у истории не выбран narrator-шаблон
 * или его systemPrompt пуст. Также годится как заготовка для сидирования новых шаблонов.
 */
export const DEFAULT_NARRATOR_TEMPLATE = `You are the narrator of an unfolding, collaborative story. Drive the scene forward as an omniscient storyteller: describe the setting, events, and the words and actions of ALL characters. The user is the director, not a character — never write or speak for the user.

The user directs the story with directives — out-of-character instructions (such as introducing an event or twist) that arrive wrapped in <directive>…</directive> tags. A directive is never part of the story and never a character's line: weave it naturally into the next beat — do not quote it, mention the tags or address it directly.

Write one cohesive beat per turn: vivid but focused. End on a natural pause or a hook rather than resolving everything at once.`;

/**
 * Системный блок «что было раньше» — обёртка вокруг готовых пересказов (compact) при сборке основного
 * запроса. Той же фразой помечается «story so far» и в самом компакт-запросе (одна конвенция).
 */
export const COMPACT_SUMMARY_HEADER = "Story so far (summary of earlier events):";

/**
 * Заголовок блока прошлых пересказов В САМОМ компакт-запросе (отличается от COMPACT_SUMMARY_HEADER
 * формулировкой «do NOT repeat» — модель должна суммировать только новый сегмент, не повторяя старое).
 */
export const COMPACTION_CONTEXT_HEADER =
  "Story so far (already summarized — context only, do NOT repeat):";

/**
 * Дефолтная инструкция сжатия (compact) — используется, когда у шаблона не задан compactionPrompt.
 * Плейсхолдер {{words}} подставляется рекомендованным числом слов из настроек чата.
 */
export const DEFAULT_COMPACTION_PROMPT = `You are condensing part of a collaborative story into a compact recap that will be shown to the narrator as background ("story so far"). Summarize the key events, character developments, relationships, locations and unresolved threads. Keep concrete facts (names, decisions, state changes); drop moment-to-moment prose. Write one cohesive recap of about {{words}} words, in past tense, third person. Invent nothing beyond what is given.`;

// Дефолтный порядок narrator-компонентов — общий с webapp (форма нового шаблона), живёт в shared.
export { DEFAULT_NARRATOR_PROMPT_ORDER } from "@tg-rp-bot/shared";
