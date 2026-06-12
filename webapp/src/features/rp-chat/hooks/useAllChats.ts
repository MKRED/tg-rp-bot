import { useEffect, useState } from "react";
import { listAllChats } from "../api/index";
import type { ChatListItem } from "../types/chat";

const PAGE_SIZE = 20;

interface AllChatsState {
  items: ChatListItem[];
  loading: boolean;
  error: boolean;
  page: number;
  setPage: (page: number) => void;
  hasMore: boolean;
}

export function useAllChats(): AllChatsState {
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listAllChats(page, PAGE_SIZE)
      .then((res) => {
        if (!cancelled) {
          setItems(res);
          // Если вернулось меньше PAGE_SIZE — следующей страницы нет
          setHasMore(res.length === PAGE_SIZE);
        }
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
  }, [page]);

  return { items, loading, error, page, setPage, hasMore };
}
