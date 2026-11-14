// Контракт API «Соавтора» (/api/coauthor) — чата с ИИ над несколькими карточками сразу. Общий для bot и webapp.
import type { AskUserQuestion } from "./cards.js";

/** Сколько карточек можно открыть в одном чате соавтора. */
export const MAX_COAUTHOR_CARDS = 4;

/** Мягкий лимит чатов соавтора на пользователя. */
export const MAX_COAUTHOR_CHATS_PER_USER = 30;

/** Предел длины одного сообщения пользователя. */
export const COAUTHOR_MESSAGE_MAX_LENGTH = 8000;

/** Предел длины своего системного промпта чата. */
export const COAUTHOR_SYSTEM_PROMPT_MAX_LENGTH = 12000;

/**
 * Лимиты хода ИИ — настройка чата. Модель знает их числами (протокол в системном промпте) и видит остаток
 * в результатах инструментов, поэтому при исчерпании заканчивает ход сама и говорит, что осталось.
 * - rounds — вызовов модели за один запуск хода (ответ на вопросы ИИ запускает ход заново); последний —
 *   без инструментов, а править можно только прочитанную (get_card) карточку, поэтому минимум 3:
 *   прочитать, поправить, ответить;
 * - edits — правок блоков за сообщение пользователя (каждый изменённый блок, неудачные попытки не в счёт);
 * - questions — пауз на вопросы ИИ за сообщение пользователя. Вопросы у соавтора включены всегда: это часть
 *   совместной работы, а частоту задаёт этот лимит.
 */
export const COAUTHOR_LIMITS = {
  rounds: { min: 3, max: 20, default: 8 },
  edits: { min: 1, max: 50, default: 24 },
  questions: { min: 1, max: 5, default: 2 },
} as const;

/** Лимиты хода чата (см. COAUTHOR_LIMITS). */
export interface CoauthorTurnLimits {
  maxRounds: number;
  maxEdits: number;
  maxQuestions: number;
}

/**
 * Стандартная редактируемая часть системного промпта — только правила поведения соавтора. Блоки пишутся
 * всегда на английском (их читает другая модель при игре), а с пользователем модель говорит на его языке —
 * отсюда раздел Language: формат блоков и бриф часто на русском, без явного правила модель зеркалит их язык.
 * Протокол
 * инструментов (edit_block, get_cards, формат карточек) сервер дописывает сам, поэтому правка промпта
 * пользователем не может сломать механику правок. В чате хранится пустая строка, пока промпт не меняли:
 * так улучшения стандарта доходят до всех чатов, где его не трогали.
 */
export const DEFAULT_COAUTHOR_SYSTEM_PROMPT =
  "You are a co-writer helping the user develop roleplay character cards. Several cards are open at once — " +
  "usually characters connected to each other (family, friends, rivals, a party). The cards are prompts that " +
  "another AI will read to play these characters.\n\n" +
  "## Language\n" +
  "- Talk to the user in the language of their latest message: your replies, ask_user questions and their " +
  "options. The cards and tool results are in English — that does not change it: a user who writes in " +
  "Russian always gets replies in Russian.\n" +
  "- Write every block in English, always — whatever language the user, the brief, the block format or your " +
  "conversation uses. Translate the user's ideas, don't copy their wording.\n" +
  "- Names: if a card already spells a name in Latin letters, reuse that spelling everywhere; otherwise " +
  "transliterate it once and keep it the same in all cards.\n" +
  "- If a block you need to change is not in English, rewrite the whole block in English with edit_block " +
  "instead of patching it: translate it faithfully and apply only the requested change — no new details. " +
  "Mention the translation in your reply.\n\n" +
  "## Writing\n" +
  "- Keep the cards consistent: shared history, relationships, names, ages, dates and facts must match. When " +
  "a change in one card affects another, propose the matching edit there too.\n" +
  "- Change only what the request needs and keep the rest of a block as it is. Don't add details nobody " +
  "asked for to blocks that are already written.\n" +
  "- Follow each block's format: it shows what to write (it may be in another language). When filling an " +
  "empty block, build on everything already written in all cards.\n" +
  "- Be concrete: specific details, habits and examples instead of generic adjectives. No meta-commentary, " +
  "notes to the user or disclaimers inside blocks. This is fiction: write flaws and dark sides honestly.\n\n" +
  "## One fact — one block\n" +
  "- Within a card, every fact lives in exactly one block: the one whose title and format fit it best. A " +
  "structured block (like Base with name, age, height) owns those facts; descriptive blocks don't restate " +
  "them — e.g. Body describes the build but doesn't repeat the height from Base. Habits go to the behaviour " +
  "block, appearance to the appearance block, and so on.\n" +
  "- Before adding information, check the whole card. If the fact is already there, change it where it is " +
  "instead of writing it again; if it is new, put it into the block where it belongs — even if the user named " +
  "another block, and then say where you put it.\n" +
  "- When you change a fact that is written in more than one block, keep it only in the block where it " +
  "belongs and remove the repetition from the others in the same edit; tell the user.\n" +
  "- Every time you read a card, look for facts repeated across its blocks. Don't fix the ones your request " +
  "does not touch — at the end of your reply list them briefly (fact and blocks) and offer to clean them up.\n" +
  "- Across cards, shared facts (a common past, a relationship) may appear in each card, written from that " +
  "character's side — but they must agree.\n\n" +
  "## Images\n" +
  "- Reference images, when present, are the source of truth for appearance. Describe what you actually see; " +
  "if the text contradicts an image, point it out.\n\n" +
  "## Working with the user\n" +
  "- Fill or change only the blocks the user asked for. If other blocks should be written or updated too, " +
  "suggest it in your reply and wait for the user's go-ahead — never fill them on your own.\n" +
  "- The character is the user's. When a card says little about who the character is — an empty or " +
  "one-line brief (\"a man\", \"an elf mage\"), few or no written blocks — don't invent them: before writing, " +
  "ask with ask_user about what the request needs (who they are, age, role, personality, past, relations " +
  "with the other cards), offering a few concrete options. A reference image shows only appearance — it " +
  "does not replace these questions. Write after the user answers.\n" +
  "- Otherwise ask only about choices that are theirs to make: their intent, a preference, an ambiguous " +
  "request. Decide small details yourself.\n" +
  "- Don't make big unrequested changes to the story or relationships — suggest them in your reply instead.\n" +
  "- Keep replies short: what you proposed and why, in a few lines. Don't repeat the block text — the user " +
  "sees your proposals.";

/** Блок карточки в чате соавтора — то, что видит пользователь во вкладке «Карточки». */
export interface CoauthorBlock {
  id: string;
  title: string;
  content: string;
}

/** Карточка, открытая в чате (только включённые блоки). */
export interface CoauthorCard {
  id: number;
  name: string;
  blocks: CoauthorBlock[];
  /** Сколько у карточки картинок-референсов (сами картинки клиенту здесь не нужны). */
  imageCount: number;
}

/**
 * Правка блока, предложенная ИИ. baseContent — текст блока в момент предложения: diff строится от него
 * (показывает ровно то, что изменила модель), и принять правку можно, только пока блок не меняли.
 * superseded — модель предложила для того же блока новую версию; stale — блок изменили вне чата.
 */
export interface CoauthorProposal {
  id: string;
  cardId: number;
  blockId: string;
  content: string;
  baseContent: string;
  status: "pending" | "accepted" | "rejected" | "superseded";
}

/** Шаг хода ИИ на экране: вызов инструмента. id — id вызова; failed — модель получила ошибку и исправится сама. */
export type CoauthorStep = { id: string; status: "running" | "done" | "failed" } & (
  /** Список карточек (list_cards) или, в старых чатах, все карточки разом (get_cards). */
  | { kind: "cards" }
  /** Модель прочитала карточку (get_card). */
  | { kind: "card"; cardId: number }
  | { kind: "search"; query: string }
  | { kind: "edit"; cardId: number; blockId: string }
);

/** Новый шаг — в конец, уже известный (тот же id) — на своём месте с новым статусом. */
export function upsertCoauthorStep(steps: CoauthorStep[], step: CoauthorStep): CoauthorStep[] {
  return steps.some((s) => s.id === step.id) ? steps.map((s) => (s.id === step.id ? step : s)) : [...steps, step];
}

/** Событие step в потоке хода. proposals — все правки чата: новая могла заменить прошлую правку того же блока. */
export interface CoauthorStepEvent {
  step: CoauthorStep;
  proposals?: CoauthorProposal[];
}

/** Событие error в потоке хода: код как у HTTP-ошибок (CoauthorError или no_api_key). */
export interface CoauthorStreamError {
  code: string;
}

/** Элемент ленты чата. Лента собирается сервером из истории диалога с моделью. */
export type CoauthorFeedItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  /** Вопросы ИИ (ask_user). answers: null — ещё ждут ответа; skipped — пользователь пропустил. */
  | { kind: "questions"; questions: AskUserQuestion[]; answers: string[] | null; skipped?: boolean }
  /** Правки, предложенные за ход модели, — статусы смотреть в proposals. */
  | { kind: "edits"; proposalIds: string[] }
  /** Что ИИ делал за этот ход, без неудачных вызовов. */
  | { kind: "steps"; steps: CoauthorStep[] };

/** Полный чат соавтора (GET /coauthor/:id и ответы всех действий). */
export interface CoauthorChat {
  id: number;
  name: string;
  cardIds: number[];
  /** Карточки чата в текущем состоянии; удалённые карточки сюда не попадают. */
  cards: CoauthorCard[];
  presetId: number | null;
  /** Свой системный промпт чата; пустая строка — стандартный (DEFAULT_COAUTHOR_SYSTEM_PROMPT). */
  systemPrompt: string;
  useWebSearch: boolean;
  /** Картинки-референсы карточек уходят модели (если модель пресета их видит). */
  useImages: boolean;
  maxRounds: number;
  maxEdits: number;
  maxQuestions: number;
  feed: CoauthorFeedItem[];
  proposals: CoauthorProposal[];
  /** Идёт ход ИИ — после обновления страницы клиент опрашивает чат, пока флаг не снимется. */
  running: boolean;
  /** Шаги идущего хода — только пока running: страница, обновлённая посреди хода, показывает их без потока. */
  liveSteps?: CoauthorStep[];
  /** Код ошибки последнего хода, если он упал (помнится недолго). */
  lastError?: string;
}

/** Строка списка (GET /coauthor). */
export interface CoauthorChatListItem {
  id: number;
  name: string;
  cardNames: string[];
  /** ISO-строка. */
  updatedAt: string;
}

/** Тело создания и правки настроек чата (POST /coauthor, PUT /coauthor/:id). */
export interface CoauthorChatInput extends CoauthorTurnLimits {
  name: string;
  cardIds: number[];
  presetId: number | null;
  systemPrompt: string;
  useWebSearch: boolean;
  useImages: boolean;
}

/** Тело POST /coauthor/:id/messages. */
export interface CoauthorMessageInput {
  text: string;
}

/** Тело POST /coauthor/:id/answer — ответы на вопросы ИИ по порядку или отказ. */
export type CoauthorAnswerInput = { skipped: true; note?: string } | { skipped: false; answers: string[]; note?: string };

/** Тело POST /coauthor/:id/review — принять или отклонить правки. */
export interface CoauthorReviewInput {
  proposalIds: string[];
  accept: boolean;
}

/**
 * Ответ /review. stale — не приняты, потому что блок успели изменить; busy — карточка занята другой
 * операцией (сохранение формы, генерация блока), можно повторить. Обе остаются ожидающими.
 */
export interface CoauthorReviewResult {
  chat: CoauthorChat;
  stale: string[];
  busy: string[];
}

/** Коды отказа в `{ error }` — webapp переводит их в понятный текст. */
export type CoauthorError =
  | "busy"
  | "preset_required"
  | "no_cards"
  | "no_pending_question"
  | "answers_mismatch"
  | "turn_failed";
