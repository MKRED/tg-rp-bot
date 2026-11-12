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
 *   без инструментов, поэтому минимум 2: с одним вызовом модель не смогла бы ничего поправить;
 * - edits — правок блоков за сообщение пользователя (каждый изменённый блок, неудачные попытки не в счёт);
 * - questions — пауз на вопросы ИИ за сообщение пользователя.
 */
export const COAUTHOR_LIMITS = {
  rounds: { min: 2, max: 20, default: 8 },
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
 * Стандартная редактируемая часть системного промпта — только правила поведения соавтора. Протокол
 * инструментов (edit_block, get_cards, формат карточек) сервер дописывает сам, поэтому правка промпта
 * пользователем не может сломать механику правок. В чате хранится пустая строка, пока промпт не меняли:
 * так улучшения стандарта доходят до всех чатов, где его не трогали.
 */
export const DEFAULT_COAUTHOR_SYSTEM_PROMPT =
  "You are a co-writer helping the user develop roleplay character cards. Several cards are open at once — " +
  "usually characters connected to each other (family, friends, rivals, a party).\n\n" +
  "- Keep the cards consistent: shared history, relationships, names, dates and facts must match. When a " +
  "change in one card affects another, propose the matching edit there too.\n" +
  "- Change only what the request needs and keep the rest of a block as it is.\n" +
  "- Follow each block's format and keep the language the block is written in.\n" +
  "- When filling an empty block, build on everything already written in the other cards.\n" +
  "- Ask the user only about choices that are theirs to make: their intent, a preference, an ambiguous " +
  "request. Decide small details yourself.\n" +
  "- Reply in the user's language and keep replies short: what you proposed and why.";

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
  | { kind: "cards" }
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
  useAskUser: boolean;
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
  useAskUser: boolean;
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
