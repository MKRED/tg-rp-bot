import type { ChatListResponse, RenameChatRequest } from "@tg-rp-bot/shared";
import { apiFetch } from "../../../shared/api/client";
import type { ChatCreated, ChatDetail, ChatInput } from "../types/chat";

// ─── Список чатов ──────────────────────────────────────────────────────────────

export function listChats(
  page: number,
  pageSize: number,
): Promise<ChatListResponse> {
  return apiFetch<ChatListResponse>(
    `/chats?page=${page}&pageSize=${pageSize}`,
  );
}

/** Создать новый чат. */
export async function createChat(input: ChatInput): Promise<ChatCreated> {
  const res = await apiFetch<{ chat: ChatCreated }>("/chats", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.chat;
}

// ─── Детали чата ───────────────────────────────────────────────────────────────

export async function getChat(id: number): Promise<ChatDetail> {
  const res = await apiFetch<{ chat: ChatDetail }>(`/chats/${id}`);
  return res.chat;
}

/**
 * Переименовать чат. Пустая строка очищает название (UI вернётся к имени персонажа).
 * Сервер обрезает title до MAX_CHAT_TITLE_LENGTH символов; возвращает применённое значение.
 */
export async function renameChat(id: number, title: string): Promise<string | null> {
  const res = await apiFetch<{ title: string | null }>(`/chats/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title } satisfies RenameChatRequest),
  });
  return res.title;
}

export async function deleteChat(id: number): Promise<void> {
  await apiFetch(`/chats/${id}`, { method: "DELETE" });
}
