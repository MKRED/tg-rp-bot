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
import { storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { NODE_H, NODE_W, layoutTreeNodes } from "../../shared/graph/treeLayout";
import "../../shared/graph/graph.css";
import { switchBranch, useStoryTree } from "../../features/narrator";
import type { StoryTreeNode } from "../../features/narrator";
import "./narrator.css";

// ─── Кастомный тип узла ────────────────────────────────────────────────────────

type StoryNodeData = {
  node: StoryTreeNode;
};

// Ярлык узла по его роли в дереве истории (kind, а не role — у narrator user-ход бывает двух видов).
const KIND_LABEL: Record<StoryTreeNode["kind"], string> = {
  beat: "Бит",
  directive: "Режиссёр",
  continue: "Дальше",
};

function StoryNode({ data }: NodeProps<Node<StoryNodeData>>) {
  const { node } = data;
  // continue хранит служебный CONTINUE_MARKER, а не прозу — для него показываем ярлык-стрелку,
  // иначе в узле торчал бы технический маркер. beat/directive показывают усечённый текст.
  const preview =
    node.kind === "continue"
      ? "▸ продолжение"
      : node.content.length > 60
        ? `${node.content.slice(0, 60)}…`
        : node.content;

  return (
    <div
      className={
        "story-graph-node" +
        (node.isOnActivePath ? " story-graph-node--active" : "") +
        (node.isCompacted ? " story-graph-node--compacted" : "")
      }
    >
      <Handle type="target" position={Position.Top} className="story-graph-node__handle" />
      <div className="story-graph-node__role">{KIND_LABEL[node.kind]}</div>
      <div className="story-graph-node__text">{preview}</div>
      <Handle type="source" position={Position.Bottom} className="story-graph-node__handle" />
    </div>
  );
}

const nodeTypes = { storyNode: StoryNode };

// ─── Страница ─────────────────────────────────────────────────────────────────

/** Граф веток истории (Narrator): всё дерево битов/директив/«Дальше», клик переключает ветку. */
export function StoryGraphPage() {
  const { id } = useParams<{ id: string }>();
  const storyId = Number(id);
  const navigate = useTransitionNavigate();
  const { nodes: treeNodes, loading } = useStoryTree(storyId);

  const positions = useMemo(() => layoutTreeNodes(treeNodes), [treeNodes]);

  const rfNodes: Node[] = useMemo(
    () =>
      treeNodes.map((n) => ({
        id: String(n.id),
        type: "storyNode",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: { node: n } satisfies StoryNodeData,
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
    let best: StoryTreeNode | null = null;
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

  // Клик по узлу переключает ветку. handleSwitchStoryBranch на сервере: по биту ставит курсор
  // ровно на узел, по директиве/«Дальше» — на её бит (прямого ребёнка), а не на конец истории,
  // чтобы можно было ответвиться из середины (история обязана заканчиваться битом). При ошибке
  // остаёмся в графе, не переходя в ленту.
  const handleNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      try {
        await switchBranch(storyId, Number(node.id));
        navigate(storyViewPath(storyId));
      } catch (err) {
        console.error("Failed to switch story branch", err);
      }
    },
    [storyId, navigate],
  );

  return (
    <PageTransition>
      <div className="story-graph-page">
        {loading ? (
          <div className="story-page__fullcenter">
            <Spinner size="m" />
          </div>
        ) : (
          <div className="story-graph-page__flow">
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
