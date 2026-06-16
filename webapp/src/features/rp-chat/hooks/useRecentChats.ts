import { useEffect, useState } from "react";
import { listRecentChats } from "../api/chats-api";
import type { ChatListItem } from "../types/chat";

interface RecentChatsState {
  items: ChatListItem[];
  loading: boolean;
  error: boolean;
}

export function useRecentChats(limit = 5): RecentChatsState {
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listRecentChats(limit)
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { items, loading, error };
}
