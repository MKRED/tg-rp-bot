import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Spinner } from "@telegram-apps/telegram-ui";
import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { NODE_H, NODE_W, layoutTreeNodes } from "../../shared/graph/treeLayout";
import "../../shared/graph/graph.css";
import { useChatTree } from "../../features/rp-chat";
import { switchBranch } from "../../features/rp-chat/api/messages-api";
import type { TreeNode } from "../../features/rp-chat";
import "./rp-chat.css";

// ─── Кастомный тип узла ────────────────────────────────────────────────────────

type ChatNodeData = {
  node: TreeNode;
};

function ChatNode({ data }: NodeProps<Node<ChatNodeData>>) {
  const { node } = data;
  const preview = node.content.length > 60
    ? `${node.content.slice(0, 60)}…`
    : node.content;

  return (
    <div className={`rp-chat-graph-node${node.isOnActivePath ? " rp-chat-graph-node--active" : ""}`}>
      <Handle type="target" position={Position.Top} className="rp-chat-graph-node__handle" />
      <div className="rp-chat-graph-node__role">
        {node.role === "assistant" ? "ИИ" : "Игрок"}
      </div>
      <div className="rp-chat-graph-node__text">{preview}</div>
      <Handle type="source" position={Position.Bottom} className="rp-chat-graph-node__handle" />
    </div>
  );
}

const nodeTypes = { chatNode: ChatNode };

// ─── Страница ─────────────────────────────────────────────────────────────────

export function RpChatGraphPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { nodes: treeNodes, loading } = useChatTree(chatId);

  const positions = useMemo(() => layoutTreeNodes(treeNodes), [treeNodes]);

  const rfNodes: Node[] = useMemo(
    () =>
      treeNodes.map((n) => ({
        id: String(n.id),
        type: "chatNode",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: { node: n } satisfies ChatNodeData,
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
          style: { stroke: "var(--tgui--hint_color, #999)", strokeWidth: 1.5 },
        })),
    [treeNodes],
  );

  // Текущая активная ячейка = самый глубокий узел активного пути (его и центрируем при открытии).
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

  // При инициализации сразу центрируемся на активной ячейке (zoom 1, без анимации),
  // чтобы граф не «разъезжался» от первого узла ко всему дереву на большой истории.
  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      const p = activeNode ? positions.get(activeNode.id) : null;
      if (p) {
        instance.setCenter(p.x + NODE_W / 2, p.y + NODE_H / 2, { zoom: 1, duration: 0 });
      } else {
        instance.fitView({ padding: 0.2 });
      }
    },
    [activeNode, positions],
  );

  // При ошибке переключения остаёмся в графе (не уходим в чат с устаревшим активным путём) и логируем.
  const handleNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      try {
        await switchBranch(chatId, Number(node.id));
        navigate(chatViewPath(chatId));
      } catch (err) {
        console.error("Failed to switch chat branch", err);
      }
    },
    [chatId, navigate],
  );

  return (
    <PageTransition>
      <div className="rp-chat-graph-page">
        {loading ? (
          <div className="rp-chat-loading">
            <Spinner size="m" />
          </div>
        ) : (
          <div className="rp-chat-graph-page__flow">
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
              <Background color="var(--tgui--hint_color, #ccc)" gap={20} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
