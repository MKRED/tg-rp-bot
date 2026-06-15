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

// ─── Layout: активный путь — прямой вертикальный «рельс», ветки веером вправо ──

const NODE_W = 220;
const NODE_H = 80;
const H_GAP = 40;
const V_GAP = 100;

// Ширина поддерева в «слотах» (листья = 1 слот). Мемоизируем в общий кэш —
// без него subtreeWidth пересчитывал бы каждое поддерево заново на каждом узле (O(n²)).
function subtreeWidth(
  id: number,
  childrenOf: Map<number | null, number[]>,
  memo: Map<number, number>,
): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  const children = childrenOf.get(id) ?? [];
  const w = children.length === 0
    ? 1
    : children.reduce((sum, cid) => sum + subtreeWidth(cid, childrenOf, memo), 0);
  memo.set(id, w);
  return w;
}

function layoutNodes(treeNodes: TreeNode[]): Map<number, { x: number; y: number }> {
  const positions = new Map<number, { x: number; y: number }>();
  const childrenOf = new Map<number | null, number[]>();
  const widthMemo = new Map<number, number>();

  for (const n of treeNodes) {
    const pid = n.parentId;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(n.id);
  }

  // Ставим активного потомка первым (он займёт самый левый слот и ляжет точно под родителя).
  // Иначе активный путь идёт через самого нового (правого) сиблинга и «сползает» вправо на
  // каждом ветвлении-перегенерации. У узла активен максимум один потомок, порядок остальных
  // (по createdAt) сохраняется.
  const activeIds = new Set(treeNodes.filter((n) => n.isOnActivePath).map((n) => n.id));
  for (const ids of childrenOf.values()) {
    ids.sort((a, b) => Number(activeIds.has(b)) - Number(activeIds.has(a)));
  }

  // Рекурсивно расставляет узел и его поддерево начиная с левой границы x (в слотах).
  function place(id: number, depth: number, slotX: number): void {
    const children = childrenOf.get(id) ?? [];
    // Узел встаёт на левый край своего поддерева (= под первым, т.е. активным, потомком).
    // Так весь активный путь выстраивается в прямую вертикаль на x = slotX*step.
    const cx = slotX * (NODE_W + H_GAP);
    positions.set(id, { x: cx, y: depth * (NODE_H + V_GAP) });

    let childSlot = slotX;
    for (const cid of children) {
      place(cid, depth + 1, childSlot);
      childSlot += subtreeWidth(cid, childrenOf, widthMemo);
    }
  }

  const roots = childrenOf.get(null) ?? [];
  let rootSlot = 0;
  for (const rid of roots) {
    place(rid, 0, rootSlot);
    rootSlot += subtreeWidth(rid, childrenOf, widthMemo);
  }

  return positions;
}

// ─── Страница ─────────────────────────────────────────────────────────────────

export function RpChatGraphPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { nodes: treeNodes, loading } = useChatTree(chatId);

  const positions = useMemo(() => layoutNodes(treeNodes), [treeNodes]);

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
          style: { stroke: "var(--tg-theme-hint-color, #999)", strokeWidth: 1.5 },
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
              <Background color="var(--tg-theme-hint-color, #ccc)" gap={20} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
