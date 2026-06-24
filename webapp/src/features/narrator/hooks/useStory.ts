import { useCallback, useEffect, useState } from "react";
import { getStory } from "../api/stories-api";
import type { StoryDetail, StoryMessage } from "../types/story";

/**
 * Загружает историю и держит локальный массив сообщений активного пути. reload() перезапрашивает
 * историю с сервера (после генерации/ветвления/удаления — чтобы пересинхронизировать активный путь).
 */
export function useStory(id: number) {
  const [story, setStory] = useState<StoryDetail>();
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    return getStory(id)
      .then((res) => {
        setStory(res.story);
        setMessages(res.story.messages);
      })
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getStory(id)
      .then((res) => {
        if (cancelled) return;
        setStory(res.story);
        setMessages(res.story.messages);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { story, messages, setMessages, loading, error, reload };
}
