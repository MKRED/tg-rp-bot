import { apiFetch } from "../../../shared/api/client";
import type { ChatCreated, ChatDetail, ChatInput, ChatListItem } from "../types/chat";

// ─── Список чатов ──────────────────────────────────────────────────────────────

export async function listRecentChats(limit = 5): Promise<ChatListItem[]> {
  try {
    const res = await apiFetch<{ items: ChatListItem[] }>(`/chats?page=1&pageSize=${limit}`);
    return res.items;
  } catch {
    return [];
  }
}

export async function listAllChats(
  page: number,
  pageSize = 20,
): Promise<{ items: ChatListItem[]; total: number }> {
  try {
    return await apiFetch<{ items: ChatListItem[]; total: number }>(
      `/chats?page=${page}&pageSize=${pageSize}`,
    );
  } catch {
    return { items: [], total: 0 };
  }
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
 * Сервер обрезает title до 100 символов; возвращает применённое значение.
 */
export async function renameChat(id: number, title: string): Promise<string | null> {
  const res = await apiFetch<{ title: string | null }>(`/chats/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
  return res.title;
}

export async function deleteChat(id: number): Promise<void> {
  await apiFetch(`/chats/${id}`, { method: "DELETE" });
}
