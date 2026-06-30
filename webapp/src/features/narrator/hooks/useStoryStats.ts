import { useCallback, useEffect, useState } from "react";
import { getStoryStats } from "../api/stats-api";
import type { StoryStats } from "../types/story";

const EMPTY_STATS: StoryStats = {
  tokensTotal: 0,
  tokensActiveBranch: 0,
  tokensPrompt: 0,
  contextLimit: null,
  compactAvailable: false,
  compactReason: null,
  templateCompactEnabled: false,
};

/**
 * Статистика истории для экрана настроек: токены (вся история / активная ветка / полный запрос).
 * Зеркало useChatStats без impersonate-вариантов (в narrator их нет).
 */
export function useStoryStats(storyId: number) {
  const [stats, setStats] = useState<StoryStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return getStoryStats(storyId)
      .then(setStats)
      .catch((err) => console.error("Failed to load story stats", err))
      .finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stats, loading, reload };
}
