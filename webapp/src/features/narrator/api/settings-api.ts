import { apiFetch } from "../../../shared/api/client";
import type { StorySettings } from "../types/story";

/** Граница webapp → /api/stories/:id/settings (настройки перевода истории). */

export async function getStorySettings(storyId: number): Promise<StorySettings> {
  const res = await apiFetch<{ settings: StorySettings }>(`/stories/${storyId}/settings`);
  return res.settings;
}

export async function updateStorySettings(
  storyId: number,
  patch: Partial<StorySettings>,
): Promise<StorySettings> {
  const res = await apiFetch<{ settings: StorySettings }>(`/stories/${storyId}/settings`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return res.settings;
}
