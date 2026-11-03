import { useCallback, useEffect, useState } from "react";
import { getCoauthorChat } from "../api/coauthor-api";
import type { CoauthorChat } from "../types/coauthor";

/** Как часто опрашивать чат, пока сервер ещё ведёт ход, начатый до обновления страницы. */
const POLL_MS = 3000;

/**
 * Чат соавтора. Если сервер сообщает running (ход начат до обновления страницы или в другой вкладке),
 * хук опрашивает чат, пока ход не закончится, — ответ ИИ подхватывается без ручного обновления.
 * polling: false — пока своя отправка ждёт ответа, опрос не нужен (результат придёт в ответе POST).
 */
export function useCoauthorChat(id: number, polling = true) {
  const [chat, setChat] = useState<CoauthorChat>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getCoauthorChat(id);
    setChat(res.chat);
    return res.chat;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCoauthorChat(id)
      .then((res) => {
        if (!cancelled) setChat(res.chat);
      })
      .catch((err) => {
        console.error("Failed to load coauthor chat", err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const running = chat?.running === true;
  useEffect(() => {
    if (!running || !polling) return;
    const timer = setInterval(() => {
      refresh().catch((err) => console.error("Failed to poll coauthor chat", err));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, polling, refresh]);

  return { chat, setChat, loading, error, refresh };
}
