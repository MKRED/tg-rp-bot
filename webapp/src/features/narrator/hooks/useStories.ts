import { useInfiniteList } from "../../../shared/hooks/useInfiniteList";
import { listStories } from "../api/stories-api";
import type { StoryListItem } from "../types/story";

// Меньше дефолтных 50: у каждой карточки свой AvatarStack (до 3 аватаров), догружаемый батчем
// (см. useAvatarBatch) — крупная страница означает столько же параллельных батч-запросов разом.
const PAGE_SIZE = 10;

/** Список историй пользователя для хаба «Режиссёр истории» — бесконечный скролл (см. useInfiniteList). */
export function useStories() {
  return useInfiniteList<StoryListItem>(listStories, PAGE_SIZE);
}
