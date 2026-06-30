import { apiFetch } from "../../../shared/api/client";
import type { StoryCompaction } from "../types/story";

/** Граница webapp → /api/stories/:id/compact* (сжатие истории). */

/** Ручное сжатие (один проход). Возвращает число созданных пересказов + обновлённый список. */
export async function compactStory(
  storyId: number,
): Promise<{ created: number; compactions: StoryCompaction[] }> {
  return apiFetch<{ created: number; compactions: StoryCompaction[] }>(
    `/stories/${storyId}/compact`,
    { method: "POST" },
  );
}

/** Список пересказов активной ветки (для настроек). */
export async function listCompactions(storyId: number): Promise<StoryCompaction[]> {
  const res = await apiFetch<{ compactions: StoryCompaction[] }>(`/stories/${storyId}/compactions`);
  return res.compactions;
}

/** Удалить пересказ каскадом вперёд. Возвращает обновлённый список. */
export async function deleteCompaction(
  storyId: number,
  compactionId: number,
): Promise<StoryCompaction[]> {
  const res = await apiFetch<{ compactions: StoryCompaction[] }>(
    `/stories/${storyId}/compactions/${compactionId}`,
    { method: "DELETE" },
  );
  return res.compactions;
}
