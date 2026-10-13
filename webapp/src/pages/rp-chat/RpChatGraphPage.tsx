import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { FullHeightPage } from "../../shared/components/FullHeightPage";
import { BranchGraph } from "../../shared/graph/BranchGraph";
import { switchBranch, useChatTree, type TreeNode } from "../../features/rp-chat";

const describe = (n: TreeNode) => ({ label: n.role === "assistant" ? "ИИ" : "Вы", text: n.content });

/** Граф веток чата: каждое сообщение — узел; нажатие делает ветку узла активной и возвращает в чат. */
export function RpChatGraphPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { nodes, loading, error } = useChatTree(chatId);

  const handleSelect = useCallback(
    async (nodeId: number) => {
      await switchBranch(chatId, nodeId);
      navigate(chatViewPath(chatId));
    },
    [chatId, navigate],
  );

  return (
    <FullHeightPage title="Граф веток чата" phase={loading ? "loading" : "ready"}>
      <BranchGraph
        nodes={nodes}
        loading={loading}
        error={error}
        describe={describe}
        onSelect={handleSelect}
        emptyDescription="Ветки появятся, когда вы начнёте диалог."
      />
    </FullHeightPage>
  );
}
