import { useEffect, useState } from "react";
import { listStories } from "../api/stories-api";
import type { StoryListItem } from "../types/story";

/** Последние истории пользователя для хаба «Режиссёр истории» (по умолчанию 5). */
export function useRecentStories(limit = 5) {
  const [items, setItems] = useState<StoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listStories(1, limit)
      .then((res) => !cancelled && setItems(res.items))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { items, loading, error };
}
