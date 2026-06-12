import { apiFetch } from "../../../shared/api/client";
import type { ChatCreated, ChatInput, ChatListItem } from "../types/chat";

/**
 * Последние N чатов пользователя.
 * Эндпоинт GET /api/chats ещё не реализован на сервере — возвращаем пустой массив
 * до появления бэкенда.
 */
export async function listRecentChats(limit = 5): Promise<ChatListItem[]> {
  try {
    return await apiFetch<ChatListItem[]>(`/chats?limit=${limit}`);
  } catch {
    return [];
  }
}

/**
 * Все чаты пользователя с пагинацией (page начинается с 1).
 */
export async function listAllChats(page: number, pageSize = 20): Promise<ChatListItem[]> {
  try {
    return await apiFetch<ChatListItem[]>(`/chats?page=${page}&pageSize=${pageSize}`);
  } catch {
    return [];
  }
}

/** Создать новый чат. */
export async function createChat(input: ChatInput): Promise<ChatCreated> {
  return apiFetch<ChatCreated>("/chats", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
