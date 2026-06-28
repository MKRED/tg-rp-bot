import type { StoryPromptOrderItem } from "../../db/schema.js";

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

/**
 * Дефолтный порядок narrator-компонентов. Используется как дефолт колонки prompt_order в БД,
 * инициализация формы нового шаблона (webapp), серверный фолбэк при отсутствии поля в запросе и
 * фолбэк storyHandlers для истории без шаблона. premise идёт после auxiliary; postHistory выключен.
 */
export const DEFAULT_NARRATOR_PROMPT_ORDER: StoryPromptOrderItem[] = [
  { id: "system", enabled: true },
  { id: "lorebook", enabled: true },
  { id: "auxiliary", enabled: true },
  { id: "premise", enabled: true },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: false },
];
