import { useEffect, useState } from "react";
import { getStoryTree } from "../api/tree-api";
import type { StoryTreeNode } from "../types/story";

/** Загружает дерево истории (все ветки) для графа. Зеркало useChatTree (RP). */
export function useStoryTree(storyId: number) {
  const [nodes, setNodes] = useState<StoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStoryTree(storyId)
      .then(setNodes)
      .catch((err) => console.error("Failed to load story tree", err))
      .finally(() => setLoading(false));
  }, [storyId]);

  return { nodes, loading };
}
