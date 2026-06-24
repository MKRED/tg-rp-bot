import { useEffect, useState } from "react";
import { listStories } from "../api/stories-api";
import type { StoryListItem } from "../types/story";

/** Список narrator-историй пользователя. */
export function useStories() {
  const [items, setItems] = useState<StoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((res) => !cancelled && setItems(res.items))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
