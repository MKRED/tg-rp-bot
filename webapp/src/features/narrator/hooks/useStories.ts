import { useInfiniteList } from "../../../shared/hooks/useInfiniteList";
import { listStories } from "../api/stories-api";
import type { StoryListItem } from "../types/story";

/** Список историй пользователя для хаба «Режиссёр истории» — бесконечный скролл (см. useInfiniteList). */
export function useStories() {
  return useInfiniteList<StoryListItem>(listStories);
}
