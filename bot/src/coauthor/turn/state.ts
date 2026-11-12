import type { AskUserQuestion, CoauthorProposal } from "@tg-rp-bot/shared";
import type { ToolCall } from "../../llm/types.js";

/**
 * Сообщение переписки с моделью в том виде, в каком оно хранится в чате. Это история протокола
 * (OpenAI-совместимая), а не лента для экрана: ленту из неё собирает feed.ts.
 * review у user — решения пользователя по правкам с прошлого сообщения: модели уходит префиксом
 * к тексту, на экране не показывается.
 * reasoning у вызова инструментов нужен только в текущем ходе: DeepSeek в режиме размышлений отвечает 400,
 * если у вызова после последнего сообщения пользователя нет рассуждения (проверено пробой), — в том числе
 * при продолжении хода после ответа на вопросы. Поэтому он сохраняется, но только у текущего хода: у прошлых
 * ходов он не нужен ни API, ни модели, и при записи выбрасывается (serializeCoauthorState).
 * Формат chat-подобный исторически (чаты писались под Chat Completions) — в элементы Responses его
 * переводит input.ts при сборке запроса, хранимое состояние не мигрируется.
 */
export type StoredMessage =
  | { role: "user"; content: string; review?: string }
  | { role: "assistant"; content: string }
  | { role: "assistant"; content: string | null; toolCalls: ToolCall[]; reasoning?: string }
  | { role: "tool"; toolCallId: string; content: string };

/**
 * Ход модели остановлен на ask_user. results — уже готовые ответы на остальные вызовы того же хода:
 * их tool-сообщения пишутся вместе с ответом на вопросы, в порядке вызовов, — иначе история
 * показала бы модели вызовы без результатов.
 */
export interface PendingQuestions {
  toolCallId: string;
  questions: AskUserQuestion[];
  results: Record<string, string>;
}

/** Всё состояние чата соавтора (колонка coauthor_chats.state, зашифрована целиком). */
export interface CoauthorState {
  messages: StoredMessage[];
  proposals: CoauthorProposal[];
  pending?: PendingQuestions;
  /** Решения по правкам, ещё не переданные модели, — уйдут со следующим сообщением пользователя. */
  reviewNotes: string[];
  /** Счётчик id правок (p1, p2, …): id не переиспользуются даже после очистки переписки. */
  nextProposalId: number;
}

export const emptyCoauthorState = (nextProposalId = 1): CoauthorState => ({
  messages: [],
  proposals: [],
  reviewNotes: [],
  nextProposalId,
});

/** Разбирает сохранённое состояние; пустая колонка — новый чат. */
export function parseCoauthorState(raw: string): CoauthorState {
  if (!raw) return emptyCoauthorState();
  const parsed = JSON.parse(raw) as Partial<CoauthorState>;
  return {
    messages: parsed.messages ?? [],
    proposals: parsed.proposals ?? [],
    ...(parsed.pending && { pending: parsed.pending }),
    reviewNotes: parsed.reviewNotes ?? [],
    nextProposalId: parsed.nextProposalId ?? 1,
  };
}

/** Сериализует состояние для записи; reasoning остаётся только у текущего хода (после последнего user). */
export function serializeCoauthorState(state: CoauthorState): string {
  const turnStart = state.messages.findLastIndex((m) => m.role === "user");
  const messages = state.messages.map((m, i) => {
    if (i > turnStart || !("toolCalls" in m) || m.reasoning === undefined) return m;
    const { reasoning: _reasoning, ...rest } = m;
    return rest;
  });
  return JSON.stringify({ ...state, messages });
}
