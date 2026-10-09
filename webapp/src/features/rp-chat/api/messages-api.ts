import {
  SSE_EVENTS,
  type SendMessageRequest,
  type SseErrorData,
  type SseTokenData,
  type TranslateMessageRequest,
  type TranslationResponse,
} from "@tg-rp-bot/shared";
import { apiFetch } from "../../../shared/api/client";
import type { MessageInPath } from "../types/chat";
import { readSSE } from "./sse";

export type SendMessageEvents = {
  onUserMessage?: (msg: MessageInPath) => void;
  onToken?: (text: string) => void;
  /** Сервер ретраит пустой/отказной ответ — стереть уже показанный стриминговый текст. */
  onReset?: () => void;
  onDone?: (msg: MessageInPath) => void;
  onError?: (message: string) => void;
};

/** Диспетчеризует события SSE обычной генерации (send/edit/regenerate) в коллбэки. */
function dispatchSendEvent(
  events: SendMessageEvents,
  event: string,
  data: Record<string, unknown>,
): void {
  if (event === SSE_EVENTS.userMessage) {
    events.onUserMessage?.(data as unknown as MessageInPath);
  } else if (event === SSE_EVENTS.token) {
    events.onToken?.((data as unknown as SseTokenData).text);
  } else if (event === SSE_EVENTS.reset) {
    events.onReset?.();
  } else if (event === SSE_EVENTS.done) {
    events.onDone?.(data as unknown as MessageInPath);
  } else if (event === SSE_EVENTS.error) {
    events.onError?.((data as unknown as SseErrorData).message);
  }
}

/**
 * Отправляет сообщение и читает SSE-поток ответа ИИ.
 * Вызывает коллбэки по мере прихода событий.
 */
export async function sendMessage(
  chatId: number,
  content: string,
  events: SendMessageEvents,
): Promise<void> {
  await readSSE(
    `/chats/${chatId}/messages`,
    { content } satisfies SendMessageRequest,
    (event, data) => dispatchSendEvent(events, event, data),
    (message) => events.onError?.(message),
  );
}

export async function editMessage(
  chatId: number,
  messageId: number,
  content: string,
  events: SendMessageEvents,
): Promise<void> {
  await readSSE(
    `/chats/${chatId}/messages/${messageId}/edit`,
    { content } satisfies SendMessageRequest,
    (event, data) => dispatchSendEvent(events, event, data),
    (message) => events.onError?.(message),
  );
}

export async function regenerateMessage(
  chatId: number,
  messageId: number,
  events: SendMessageEvents,
): Promise<void> {
  await readSSE(
    `/chats/${chatId}/messages/${messageId}/regenerate`,
    {},
    (event, data) => dispatchSendEvent(events, event, data),
    (message) => events.onError?.(message),
  );
}

// ─── Удаление / ветвление / перевод ────────────────────────────────────────────

export async function deleteMessage(chatId: number, messageId: number): Promise<void> {
  await apiFetch(`/chats/${chatId}/messages/${messageId}`, { method: "DELETE" });
}

export async function switchBranch(chatId: number, messageId: number): Promise<void> {
  await apiFetch(`/chats/${chatId}/messages/${messageId}/branch`, { method: "POST" });
}

/**
 * Переводит сообщение и кэширует результат на сервере (метод google/ai берётся из настроек чата).
 * force=true пропускает кэш и пересчитывает перевод заново, перезаписывая его.
 */
export async function translateMessage(
  chatId: number,
  messageId: number,
  targetLang: string,
  opts?: { force?: boolean },
): Promise<string> {
  const body: TranslateMessageRequest = { targetLang, force: opts?.force ?? false };
  const res = await apiFetch<TranslationResponse>(
    `/chats/${chatId}/messages/${messageId}/translate`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.translation;
}

/** Убирает закэшированный перевод сообщения для одного языка. */
export async function deleteTranslation(
  chatId: number,
  messageId: number,
  targetLang: string,
): Promise<void> {
  await apiFetch(
    `/chats/${chatId}/messages/${messageId}/translate?lang=${encodeURIComponent(targetLang)}`,
    { method: "DELETE" },
  );
}
