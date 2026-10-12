import { Loader } from "@mantine/core";
import { Background, Controls, ReactFlow, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { EmptyState } from "../../shared/components/EmptyState";
import { FullHeightPage } from "../../shared/components/FullHeightPage";
import { NODE_H, NODE_W, layoutTreeNodes } from "../../shared/graph/treeLayout";
import "../../shared/graph/graph.css";
import { useToast } from "../../shared/toast";
import { ChatGraphNode, switchBranch, useChatTree, type ChatGraphNodeData, type TreeNode } from "../../features/rp-chat";
import styles from "./RpChatGraphPage.module.css";

const nodeTypes = { chatNode: ChatGraphNode };

/** Граф веток чата: каждое сообщение — узел; нажатие делает ветку узла активной и возвращает в чат. */
export function RpChatGraphPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const { nodes: treeNodes, loading, error } = useChatTree(chatId);

  const positions = useMemo(() => layoutTreeNodes(treeNodes), [treeNodes]);

  const rfNodes: Node[] = useMemo(
    () =>
      treeNodes.map((n) => ({
        id: String(n.id),
        type: "chatNode",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: { node: n } satisfies ChatGraphNodeData,
      })),
    [treeNodes, positions],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      treeNodes
        .filter((n) => n.parentId != null)
        .map((n) => ({
          id: `${n.parentId}-${n.id}`,
          source: String(n.parentId),
          target: String(n.id),
          style: { stroke: "var(--mantine-color-dimmed)", strokeWidth: 1.5 },
        })),
    [treeNodes],
  );

  // Текущая позиция = самый глубокий узел активного пути (его и центрируем при открытии).
  const activeNode = useMemo(() => {
    let best: TreeNode | null = null;
    for (const n of treeNodes) {
      if (!n.isOnActivePath) continue;
      const p = positions.get(n.id);
      const bp = best ? positions.get(best.id) : null;
      if (!bp || (p && p.y > bp.y)) best = n;
    }
    return best;
  }, [treeNodes, positions]);

  // Сразу центрируемся на активном узле (zoom 1, без анимации), чтобы граф большой истории
  // не «разъезжался» от первого узла ко всему дереву.
  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      const p = activeNode ? positions.get(activeNode.id) : null;
      if (p) instance.setCenter(p.x + NODE_W / 2, p.y + NODE_H / 2, { zoom: 1, duration: 0 });
      else instance.fitView({ padding: 0.2 });
    },
    [activeNode, positions],
  );

  // Ошибка переключения — остаёмся в графе: в чат с устаревшей веткой не уходим.
  const handleNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      try {
        await switchBranch(chatId, Number(node.id));
        navigate(chatViewPath(chatId));
      } catch (err) {
        console.error("Failed to switch chat branch", err);
        showToast({ type: "error", message: "Не удалось переключить ветку" });
      }
    },
    [chatId, navigate, showToast],
  );

  return (
    <FullHeightPage phase={loading ? "loading" : "ready"}>
      {loading ? (
        <div className={styles.center}>
          <Loader />
        </div>
      ) : error ? (
        <div className={styles.center}>
          <EmptyState icon={GitBranch} title="Не удалось загрузить ветки" description="Проверьте соединение и откройте экран снова." />
        </div>
      ) : treeNodes.length === 0 ? (
        <div className={styles.center}>
          <EmptyState icon={GitBranch} title="Сообщений пока нет" description="Ветки появятся, когда вы начнёте диалог." />
        </div>
      ) : (
        <div className={styles.flow}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onInit={handleInit}
            onNodeClick={handleNodeClick}
            nodesDraggable={false}
            nodesConnectable={false}
            onlyRenderVisibleElements
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--mantine-color-default-border)" gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}
    </FullHeightPage>
  );
}
