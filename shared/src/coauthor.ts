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

/** Элемент ленты чата. Лента собирается сервером из истории диалога с моделью. */
export type CoauthorFeedItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  /** Вопросы ИИ (ask_user). answers: null — ещё ждут ответа; skipped — пользователь пропустил. */
  | { kind: "questions"; questions: AskUserQuestion[]; answers: string[] | null; skipped?: boolean }
  /** Правки, предложенные за ход модели, — статусы смотреть в proposals. */
  | { kind: "edits"; proposalIds: string[] };

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
  feed: CoauthorFeedItem[];
  proposals: CoauthorProposal[];
  /** Идёт ход ИИ — после обновления страницы клиент опрашивает чат, пока флаг не снимется. */
  running: boolean;
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
export interface CoauthorChatInput {
  name: string;
  cardIds: number[];
  presetId: number | null;
  systemPrompt: string;
  useAskUser: boolean;
  useWebSearch: boolean;
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
