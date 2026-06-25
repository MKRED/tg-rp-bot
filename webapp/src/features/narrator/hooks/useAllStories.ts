import { useEffect, useState } from "react";
import { listStories } from "../api/stories-api";
import type { StoryListItem } from "../types/story";

const PAGE_SIZE = 20;

interface AllStoriesState {
  items: StoryListItem[];
  loading: boolean;
  error: boolean;
  page: number;
  setPage: (page: number) => void;
  hasMore: boolean;
}

/** Полный список историй с постраничной навигацией. */
export function useAllStories(): AllStoriesState {
  const [items, setItems] = useState<StoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listStories(page, PAGE_SIZE)
      .then(({ items: newItems, total }) => {
        if (!cancelled) {
          setItems(newItems);
          setHasMore(page * PAGE_SIZE < total);
        }
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page]);

  return { items, loading, error, page, setPage, hasMore };
}
