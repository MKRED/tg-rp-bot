// Контракт API карточек «Мастерской» (/api/cards) — общий для bot и webapp.

/** Один уточняющий вопрос от модели (ask_user). */
export interface AskUserQuestion {
  question: string;
  /** Варианты-подсказки от модели — пользователь всё равно может ввести свой текст. */
  options?: string[];
}

/**
 * Вопрос-ответ ask_user, уже отвеченный (или пропущенный). options — те же варианты-подсказки, что
 * были у исходного AskUserQuestion: сервер хранит их вместе с ответом, чтобы реплей в сборке промпта
 * восстанавливал tool_call модели один в один, а не усечённым — иначе история показывала бы модели,
 * что её же прошлые вызовы ask_user никогда не предлагали options, и она перестала бы их предлагать.
 */
export interface AskUserAnswer {
  question: string;
  answer: string;
  options?: string[];
}

/**
 * Категория карточки (cards.categories) — редактируемый пользователем блок структуры (например
 * "Base", "Body"): title/description — то, что ИИ видит как заголовок и пример формата (собирается
 * в <example>…</example>), content — сгенерированный/отредактированный текст блока (пусто = ещё не
 * сгенерирован). Порядок генерации/сборки промпта = порядок элементов массива.
 *
 * pendingQuestions/askUserAnswers — состояние ask_user, сервер-владеемое: хранится прямо на категории,
 * а не в памяти процесса (у пользователя нет ограничения по времени на ответ). pendingQuestions —
 * вопросы, ещё ожидающие ответа для ЭТОГО блока; askUserAnswers — уже отвеченные (или пропущенные)
 * пары: контекст для его собственной генерации после ответа и для последующих блоков. Клиент их
 * только читает — во входе POST/PUT сервер их отбрасывает и переносит из сохранённой строки.
 */
export interface CardCategory {
  id: string;
  title: string;
  description: string;
  content: string;
  enabled: boolean;
  pendingQuestions?: AskUserQuestion[];
  askUserAnswers?: AskUserAnswer[];
}

/** Тело формы создания/правки (POST/PUT). */
export interface CardInput {
  name: string;
  systemPrompt: string;
  prompt: string;
  categories: CardCategory[];
  /** null — пресет ещё не выбран (генерация недоступна до выбора). */
  presetId: number | null;
  useWebSearch: boolean;
  useAskUser: boolean;
}

/** Строка списка (GET /cards) — имя + дата обновления. */
export interface CardListItem {
  id: number;
  name: string;
  /** ISO-строка. */
  updatedAt: string;
}

// Мягкий лимит: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_CARDS_PER_USER = 50;

/** Максимум категорий структуры на карточку (как MAX_FIRST_MESSAGES у персонажа) — защита от абьюза. */
export const MAX_CARD_CATEGORIES = 30;

/**
 * Дефолтные системные инструкции новой карточки (role: system в сборке генерации) — поблочный
 * контракт: <example> в первом user-сообщении — только образец структуры, ответ — только текст блока
 * без обрамления, дальнейшие блоки согласованы с уже сгенерированными. Webapp показывает его в форме
 * создания, сервер подставляет вместо пустого значения (и на чтении — у старых карточек без поля).
 */
export const DEFAULT_CARD_SYSTEM_PROMPT =
  "You are generating a character card block by block. The user's first message contains a " +
  "character brief and an <example> block showing the title and expected format of every block " +
  "in the card — treat <example> only as a structural reference, never copy its placeholder text. " +
  "Each user request names exactly one block to generate; reply with that block's content only — " +
  "plain text, no title, no markdown wrapping, no explanations. Stay consistent with any blocks " +
  "you already generated earlier in this conversation.";

/**
 * Дефолтный основной промпт новой карточки. {{example}} в нём нет — при сборке структура
 * дописывается в конец; пользователь может вставить плейсхолдер явно, чтобы переставить её внутрь.
 */
export const DEFAULT_CARD_PROMPT = "Create a highly detailed AI character card";

/**
 * Дефолтная структура карточки — категории по образцу типичной карточки персонажа. description —
 * пример формата (что ИИ должен сгенерировать), content пуст. Webapp показывает её сразу в форме
 * создания, сервер подставляет вместо пустого массива на вставке.
 */
export const DEFAULT_CARD_CATEGORIES: CardCategory[] = [
  { id: "base", title: "Base", description: "Name: ...\nRace: ...\nSex: ...\nAge: ...\nHeight: ...", content: "", enabled: true },
  { id: "body", title: "Body", description: "Подробное описание телосложения, черт лица, особых примет.", content: "", enabled: true },
  { id: "outfit", title: "Outfit", description: "Повседневный наряд персонажа, аксессуары.", content: "", enabled: true },
  { id: "personality", title: "Personality", description: "Черты характера, ценности, страхи, мотивация.", content: "", enabled: true },
  { id: "speechStyle", title: "Speech Style", description: "Манера речи, характерные фразы, тон.", content: "", enabled: true },
  { id: "behaviours", title: "Behaviours", description: "Типичные привычки и реакции в разных ситуациях.", content: "", enabled: true },
  { id: "hobbiesLikes", title: "Hobbies / Likes", description: "Увлечения и то, что персонажу нравится.", content: "", enabled: true },
  { id: "dislikes", title: "Dislikes", description: "То, что персонаж не любит или чего избегает.", content: "", enabled: true },
  { id: "background", title: "Background", description: "История персонажа, прошлое, ключевые события.", content: "", enabled: true },
];

/**
 * Ответ обеих ручек генерации (POST /cards/:id/generate и /generate/answer). "done" — блок готов и уже
 * сохранён (клиент мержит точечно по categoryId, не всю карточку — не затирая несохранённые правки
 * других категорий); "questions" — модель попросила уточнение (ask_user), вопросы уже сохранены на
 * категории, ограничения по времени на ответ нет.
 */
export type CardGenerationStep =
  | { status: "done"; categoryId: string; content: string }
  | { status: "questions"; categoryId: string; questions: AskUserQuestion[] };

/** Ответ на вопросы ask_user (тело /generate/answer без categoryId): ответы по порядку вопросов или отказ. */
export type AnswerCardQuestionsInput = { skipped: true } | { skipped: false; answers: string[] };

/** Коды отказа генерации в `{ error }` — webapp переводит их в понятный текст. */
export type CardGenerationError =
  | "not_found"
  | "busy"
  | "preset_required"
  | "target_not_found"
  | "nothing_to_generate"
  | "no_pending_question"
  | "answers_mismatch";
