import { useCallback, useEffect, useState } from "react";
import { getChat } from "../api/chats-api";
import type { ChatDetail } from "../types/chat";

export function useChat(id: number) {
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    getChat(id)
      .then((data) => setChat(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { chat, loading, error, refresh, setChat };
}
