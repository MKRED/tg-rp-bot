import { apiFetch } from "../../../shared/api/client";
import type { StoryStats } from "../types/story";

/** Граница webapp → /api/stories/:id/stats (токены истории для экрана настроек). */
export async function getStoryStats(storyId: number): Promise<StoryStats> {
  const res = await apiFetch<{ stats: StoryStats }>(`/stories/${storyId}/stats`);
  return res.stats;
}
