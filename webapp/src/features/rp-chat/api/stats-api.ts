import { apiFetch } from "../../../shared/api/client";
import type { ChatStats } from "../types/chat";

/** Статистика чата (токены + число сохранённых impersonate-вариантов) для экрана настроек. */
export async function getChatStats(chatId: number): Promise<ChatStats> {
  const res = await apiFetch<{ stats: ChatStats }>(`/chats/${chatId}/stats`);
  return res.stats;
}
