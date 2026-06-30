import { useCallback, useEffect, useState } from "react";
import {
  compactStory as apiCompactStory,
  deleteCompaction as apiDeleteCompaction,
  listCompactions,
} from "../api/compact-api";
import type { StoryCompaction } from "../types/story";

/**
 * Пересказы активной ветки истории: загрузка списка + ручное сжатие + удаление (каскадом вперёд).
 * compact возвращает число созданных пересказов (0 = нечего сжимать — UI покажет toast).
 */
export function useCompactions(storyId: number) {
  const [compactions, setCompactions] = useState<StoryCompaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    return listCompactions(storyId)
      .then(setCompactions)
      .catch((err) => console.error("Failed to load compactions", err))
      .finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const compact = useCallback(async (): Promise<number> => {
    setBusy(true);
    try {
      const { created, compactions: next } = await apiCompactStory(storyId);
      setCompactions(next);
      return created;
    } finally {
      setBusy(false);
    }
  }, [storyId]);

  const remove = useCallback(
    async (compactionId: number) => {
      setBusy(true);
      try {
        setCompactions(await apiDeleteCompaction(storyId, compactionId));
      } finally {
        setBusy(false);
      }
    },
    [storyId],
  );

  return { compactions, loading, busy, reload, compact, remove };
}
