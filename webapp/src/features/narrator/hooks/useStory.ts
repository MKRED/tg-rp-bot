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

  // onApplied вызывается в том же setState-батче, что и setStory/setMessages — чтобы вызывающий
  // мог снять стримящийся текст одновременно с появлением реального бита (без «дёрганья» ленты:
  // иначе сначала исчезает стрим → лента короче → скролл прыгает вверх, потом приходит бит → вниз).
  const reload = useCallback((onApplied?: () => void) => {
    return getStory(id)
      .then((res) => {
        setStory(res.story);
        setMessages(res.story.messages);
        onApplied?.();
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
