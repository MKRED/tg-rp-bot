import { useInfiniteList } from "../../../shared/hooks/useInfiniteList";
import { listChats } from "../api/chats-api";
import type { ChatListItem } from "../types/chat";

/** Список чатов пользователя для хаба «Ролевой чат» — бесконечный скролл (см. useInfiniteList). */
export function useChats() {
  return useInfiniteList<ChatListItem>(listChats);
}
