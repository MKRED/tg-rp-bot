import { useEffect, useState } from "react";
import { getStoryTree } from "../api/tree-api";
import type { StoryTreeNode } from "../types/story";

/** Загружает дерево истории (все ветки) для графа. Зеркало useChatTree (RP). */
export function useStoryTree(storyId: number) {
  const [nodes, setNodes] = useState<StoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getStoryTree(storyId)
      .then(setNodes)
      .catch((err) => {
        console.error("Failed to load story tree", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [storyId]);

  return { nodes, loading, error };
}
