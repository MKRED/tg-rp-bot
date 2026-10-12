import { useEffect, useState } from "react";
import { getChatTree } from "../api/tree-api";
import type { TreeNode } from "../types/chat";

export function useChatTree(chatId: number) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getChatTree(chatId)
      .then(setNodes)
      .catch((err) => {
        console.error("Failed to load chat tree", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [chatId]);

  return { nodes, loading, error };
}
