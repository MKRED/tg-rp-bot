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
  if (event === "userMessage") {
    events.onUserMessage?.(data as unknown as MessageInPath);
  } else if (event === "token") {
    events.onToken?.(data.text as string);
  } else if (event === "reset") {
    events.onReset?.();
  } else if (event === "done") {
    events.onDone?.(data as unknown as MessageInPath);
  } else if (event === "error") {
    events.onError?.(data.message as string);
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
    { content },
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
    { content },
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

export async function translateMessage(
  chatId: number,
  messageId: number,
  targetLang: string,
): Promise<string> {
  const res = await apiFetch<{ translation: string }>(
    `/chats/${chatId}/messages/${messageId}/translate`,
    { method: "POST", body: JSON.stringify({ targetLang }) },
  );
  return res.translation;
}
