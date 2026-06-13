import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Spinner } from "@telegram-apps/telegram-ui";
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { useChatTree } from "../../features/rp-chat";
import { switchBranch } from "../../features/rp-chat/api/index";
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

// ─── BFS-layout для позиций узлов ────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 80;
const H_GAP = 60;
const V_GAP = 100;

function layoutNodes(treeNodes: TreeNode[]): Map<number, { x: number; y: number }> {
  const positions = new Map<number, { x: number; y: number }>();
  const childrenOf = new Map<number | null, number[]>();

  for (const n of treeNodes) {
    const pid = n.parentId;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(n.id);
  }

  // BFS по уровням
  const queue: Array<{ id: number; depth: number; col: number }> = [];
  const roots = childrenOf.get(null) ?? [];
  roots.forEach((id, i) => queue.push({ id, depth: 0, col: i }));

  const colCountAtDepth = new Map<number, number>();

  while (queue.length > 0) {
    const { id, depth, col } = queue.shift()!;
    positions.set(id, { x: col * (NODE_W + H_GAP), y: depth * (NODE_H + V_GAP) });

    const children = childrenOf.get(id) ?? [];
    const start = colCountAtDepth.get(depth + 1) ?? col;
    colCountAtDepth.set(depth + 1, start + children.length);
    children.forEach((cid, i) => queue.push({ id: cid, depth: depth + 1, col: start + i }));
  }

  return positions;
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export function RpChatGraphPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { nodes: treeNodes, loading } = useChatTree(chatId);

  const positions = layoutNodes(treeNodes);

  const rfNodes: Node[] = treeNodes.map((n) => ({
    id: String(n.id),
    type: "chatNode",
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    data: { node: n } satisfies ChatNodeData,
  }));

  const rfEdges: Edge[] = treeNodes
    .filter((n) => n.parentId != null)
    .map((n) => ({
      id: `${n.parentId}-${n.id}`,
      source: String(n.parentId),
      target: String(n.id),
      type: "smoothstep",
      style: { stroke: "var(--tg-theme-hint-color, #999)", strokeWidth: 1.5 },
    }));

  const handleNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      const nodeId = Number(node.id);
      await switchBranch(chatId, nodeId);
      navigate(chatViewPath(chatId));
    },
    [chatId, navigate],
  );

  return (
    <PageTransition>
      <div className="rp-chat-graph-page">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Spinner size="m" />
          </div>
        ) : (
          <div className="rp-chat-graph-page__flow">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ duration: 800, padding: 0.2 }}
              minZoom={0.1}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--tg-theme-hint-color, #ccc)" gap={20} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
