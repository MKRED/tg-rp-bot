import { useEffect, useState } from "react";
import { getChatTree } from "../api/tree-api";
import type { TreeNode } from "../types/chat";

export function useChatTree(chatId: number) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getChatTree(chatId)
      .then(setNodes)
      .catch((err) => console.error("Failed to load chat tree", err))
      .finally(() => setLoading(false));
  }, [chatId]);

  return { nodes, loading };
}
