import { apiFetch } from "../../../shared/api/client";
import type { TreeNode } from "../types/chat";

export async function getChatTree(chatId: number): Promise<TreeNode[]> {
  const res = await apiFetch<{ nodes: TreeNode[] }>(`/chats/${chatId}/tree`);
  return res.nodes;
}
