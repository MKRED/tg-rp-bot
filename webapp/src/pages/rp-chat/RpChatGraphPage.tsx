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

// ─── Layout: tidy-tree (контурная упаковка), родитель центрирован над детьми ───

const NODE_W = 220;
const NODE_H = 80;
const H_GAP = 40;
const V_GAP = 100;

// Раскладка поддерева относительно его корня (корень в x = 0) + контуры по глубинам.
type SubtreeLayout = {
  x: Map<number, number>; // x каждого узла относительно корня поддерева
  left: number[]; // левый контур: min x на каждой относительной глубине (0 = корень)
  right: number[]; // правый контур: max x на каждой относительной глубине
};

function layoutNodes(treeNodes: TreeNode[]): Map<number, { x: number; y: number }> {
  const childrenOf = new Map<number | null, number[]>();
  for (const n of treeNodes) {
    const pid = n.parentId;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(n.id);
  }

  // Порядок детей оставляем как пришёл из getChatTree (по createdAt): регенерации-сиблинги
  // стоят группой, продолжение пути естественно уходит из самого нового (правого) узла.

  const HSTEP = NODE_W + H_GAP; // минимальный зазор по горизонтали между узлами одной глубины

  // Контурная упаковка (tidy-tree): дети размещаются плотным рядом (каждый следующий сдвигается
  // вправо ровно настолько, чтобы его левый контур не задел правый контур уже размещённых
  // соседей), а родитель центрируется над серединой группы детей. Так регенерации одного
  // сообщения держатся вместе, а не разлетаются по ширине своих поддеревьев.
  function layout(id: number): SubtreeLayout {
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      return { x: new Map([[id, 0]]), left: [0], right: [0] };
    }

    const childLayouts = children.map(layout);
    const offsets: number[] = [0]; // сдвиг каждого потомка относительно корня; первый — 0
    const runRight = childLayouts[0]!.right.slice(); // правый контур уже размещённых сиблингов

    for (let i = 1; i < children.length; i++) {
      const L = childLayouts[i]!;
      // Минимальный сдвиг вправо: на каждой общей глубине левый контур i-го должен отстоять от
      // правого контура соседей на HSTEP.
      let shift = 0;
      const shared = Math.min(runRight.length, L.left.length);
      for (let d = 0; d < shared; d++) {
        shift = Math.max(shift, runRight[d]! - L.left[d]! + HSTEP);
      }
      offsets[i] = shift;
      for (let d = 0; d < L.right.length; d++) {
        const v = L.right[d]! + shift;
        runRight[d] = d < runRight.length ? Math.max(runRight[d]!, v) : v;
      }
    }

    // Центр группы детей = середина между первым (offset 0) и последним. Сдвигаем всё поддерево
    // так, чтобы родитель встал над этим центром, а корень поддерева остался в x = 0 (соглашение).
    const center = offsets[children.length - 1]! / 2;

    // Собираем координаты поддерева и его контуры. Корень = 0 (над серединой группы детей).
    const x = new Map<number, number>([[id, 0]]);
    const left = [0];
    const right = [0];
    for (let i = 0; i < children.length; i++) {
      const off = offsets[i]! - center;
      const cLayout = childLayouts[i]!;
      for (const [nid, nx] of cLayout.x) x.set(nid, nx + off);
      const { left: cl, right: cr } = cLayout;
      for (let d = 0; d < cl.length; d++) {
        const depth = d + 1; // контур потомка на глубине d → глубина d+1 в текущем поддереве
        const lv = cl[d]! + off;
        const rv = cr[d]! + off;
        if (depth < left.length) {
          left[depth] = Math.min(left[depth]!, lv);
          right[depth] = Math.max(right[depth]!, rv);
        } else {
          left[depth] = lv;
          right[depth] = rv;
        }
      }
    }
    return { x, left, right };
  }

  // Глубины (для y) — отдельный обход от корней.
  const roots = childrenOf.get(null) ?? [];
  const depthOf = new Map<number, number>();
  const stack: Array<{ id: number; depth: number }> = roots.map((id) => ({ id, depth: 0 }));
  while (stack.length) {
    const { id, depth } = stack.pop()!;
    depthOf.set(id, depth);
    for (const cid of childrenOf.get(id) ?? []) stack.push({ id: cid, depth: depth + 1 });
  }

  // Раскладываем каждый корень и пакуем корни слева направо тем же контурным способом.
  const positions = new Map<number, { x: number; y: number }>();
  const rootRight: number[] = [];
  for (const rid of roots) {
    const sub = layout(rid);
    let shift = 0;
    const shared = Math.min(rootRight.length, sub.left.length);
    for (let d = 0; d < shared; d++) {
      shift = Math.max(shift, rootRight[d]! - sub.left[d]! + HSTEP);
    }
    for (const [nid, nx] of sub.x) {
      positions.set(nid, { x: nx + shift, y: (depthOf.get(nid) ?? 0) * (NODE_H + V_GAP) });
    }
    for (let d = 0; d < sub.right.length; d++) {
      const v = sub.right[d]! + shift;
      rootRight[d] = d < rootRight.length ? Math.max(rootRight[d]!, v) : v;
    }
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
