import { apiFetch } from "../../../shared/api/client";
import type { StoryTreeNode } from "../types/story";

/** Дерево истории (все ветки) для страницы графа. */
export async function getStoryTree(storyId: number): Promise<StoryTreeNode[]> {
  const res = await apiFetch<{ nodes: StoryTreeNode[] }>(`/stories/${storyId}/tree`);
  return res.nodes;
}
