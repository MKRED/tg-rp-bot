/**
 * Типы компонентов промптов — вынесены из schema.ts (там остаются только определения таблиц).
 * Используются как `.$type<…>()` колонок prompt_order и валидацией/билдерами промптов.
 */

/** Компонент запроса к нейросети, чей порядок и включённость настраиваются в пресете. */
export type PromptComponentId =
  | "system"
  | "characterDescription"
  | "characterScenario"
  | "userDescription"
  | "auxiliary"
  | "history"
  | "postHistory";

/** Элемент порядка промптов: какой компонент и включён ли он в запрос. */
export type PromptOrderItem = { id: PromptComponentId; enabled: boolean };

/** Компонент narrator-запроса, чей порядок и включённость настраиваются в шаблоне. */
export type StoryPromptComponentId =
  | "system"
  | "premise"
  | "lorebook"
  | "auxiliary"
  | "compact"
  | "history"
  | "postHistory";

/** Элемент порядка narrator-промптов: какой компонент и включён ли он в запрос. */
export type StoryPromptOrderItem = { id: StoryPromptComponentId; enabled: boolean };

/** Один уточняющий вопрос от модели (ask_user) — см. server/cards/generation/askUserTool.ts. */
export type AskUserQuestion = {
  question: string;
  /** Варианты-подсказки от модели — пользователь всё равно может ввести свой текст. */
  options?: string[];
};

/** Вопрос-ответ ask_user, уже отвеченный (или пропущенный — см. ASK_USER_DECLINED_ANSWER). */
export type AskUserAnswer = {
  question: string;
  answer: string;
};

/**
 * Категория карточки «Мастерской» (cards.categories) — редактируемый пользователем блок структуры
 * (например "Base", "Body"): title/description — то, что ИИ видит как заголовок и пример формата
 * (собирается в <example>…</example>), content — сгенерированный/отредактированный текст блока
 * (пусто = ещё не сгенерирован). Порядок генерации/сборки промпта = порядок элементов массива.
 * Все текстовые поля шифруются per-user в DAO (как prompt/footnote у characters), enabled/id — нет.
 *
 * pendingQuestions/askUserAnswers — состояние ask_user (см. askUserTool.ts) хранится прямо на
 * категории, а не в памяти процесса: у пользователя нет ограничения по времени на ответ, а карточка
 * не считается занятой (cardLock), пока вопрос висит без ответа. pendingQuestions — вопросы, ещё
 * ожидающие ответа для ЭТОГО блока (undefined/пусто — вопросов нет). askUserAnswers — уже отвеченные
 * (или пропущенные) вопрос-ответ пары этого блока: контекст для его собственной генерации после
 * ответа и для последующих блоков (см. assembleCardBlockPrompt, который подмешивает их в историю).
 */
export type CardCategory = {
  id: string;
  title: string;
  description: string;
  content: string;
  enabled: boolean;
  pendingQuestions?: AskUserQuestion[];
  askUserAnswers?: AskUserAnswer[];
};
