import { useEffect, useState } from "react";
import { listCoauthorChats } from "../api/coauthor-api";
import type { CoauthorChatListItem } from "../types/coauthor";

/** Список чатов соавтора (как useCards: перезапрос не нужен — возврат на экран его перемонтирует). */
export function useCoauthorChats() {
  const [items, setItems] = useState<CoauthorChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCoauthorChats()
      .then((res) => {
        if (!cancelled) setItems(res.chats);
      })
      .catch((err) => {
        console.error("Failed to load coauthor chats", err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
