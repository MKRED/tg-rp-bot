import { Loader } from "@mantine/core";
import { Background, Controls, ReactFlow, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch } from "lucide-react";
import { useCallback, useMemo } from "react";
import { EmptyState } from "../../components/EmptyState";
import { useToast } from "../../toast";
import { NODE_H, NODE_W, layoutTreeNodes } from "../treeLayout";
import "../graph.css";
import { BranchGraphNode, type BranchNodeData } from "./BranchGraphNode";
import styles from "./BranchGraph.module.css";

/** Минимум, который граф знает об узле дерева. */
export interface BranchTreeNode {
  id: number;
  parentId: number | null;
  isOnActivePath: boolean;
}

interface BranchGraphProps<T extends BranchTreeNode> {
  nodes: T[];
  loading: boolean;
  error: boolean;
  /** Подпись и текст узла — у чата и истории свои. Стабильная ссылка (функция вне компонента или useCallback). */
  describe: (node: T) => Omit<BranchNodeData, "active">;
  /** Переключает ветку на узел и уводит в ленту; при ошибке бросает — граф покажет тост и останется. */
  onSelect: (id: number) => Promise<void>;
  emptyDescription: string;
}

const nodeTypes = { branch: BranchGraphNode };

/**
 * Граф веток (React Flow) — общий для RP-чата и истории рассказчика: каждое сообщение — узел, нажатие
 * делает его ветку активной. Состояния загрузки, ошибки и пустого дерева — здесь же. Кладётся в
 * FullHeightPage и занимает всю оставшуюся высоту.
 */
export function BranchGraph<T extends BranchTreeNode>({
  nodes: treeNodes,
  loading,
  error,
  describe,
  onSelect,
  emptyDescription,
}: BranchGraphProps<T>) {
  const { showToast } = useToast();
  const positions = useMemo(() => layoutTreeNodes(treeNodes), [treeNodes]);

  const rfNodes: Node<BranchNodeData>[] = useMemo(
    () =>
      treeNodes.map((n) => ({
        id: String(n.id),
        type: "branch",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: { ...describe(n), active: n.isOnActivePath },
      })),
    [treeNodes, positions, describe],
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
  const activeId = useMemo(() => {
    let best: number | null = null;
    for (const n of treeNodes) {
      if (!n.isOnActivePath) continue;
      const p = positions.get(n.id);
      const bp = best !== null ? positions.get(best) : null;
      if (!bp || (p && p.y > bp.y)) best = n.id;
    }
    return best;
  }, [treeNodes, positions]);

  // Сразу центрируемся на активном узле (zoom 1, без анимации), чтобы граф большой истории
  // не «разъезжался» от первого узла ко всему дереву.
  const handleInit = useCallback(
    (instance: ReactFlowInstance<Node<BranchNodeData>>) => {
      const p = activeId !== null ? positions.get(activeId) : null;
      if (p) instance.setCenter(p.x + NODE_W / 2, p.y + NODE_H / 2, { zoom: 1, duration: 0 });
      else instance.fitView({ padding: 0.2 });
    },
    [activeId, positions],
  );

  // Ошибка переключения — остаёмся в графе: в ленту с устаревшей веткой не уходим.
  const handleNodeClick = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      try {
        await onSelect(Number(node.id));
      } catch (err) {
        console.error("Failed to switch branch", err);
        showToast({ type: "error", message: "Не удалось переключить ветку" });
      }
    },
    [onSelect, showToast],
  );

  if (loading) {
    return (
      <div className={styles.center}>
        <Loader />
      </div>
    );
  }
  if (error) {
    return (
      <div className={styles.center}>
        <EmptyState icon={GitBranch} title="Не удалось загрузить ветки" description="Проверьте соединение и откройте экран снова." />
      </div>
    );
  }
  if (treeNodes.length === 0) {
    return (
      <div className={styles.center}>
        <EmptyState icon={GitBranch} title="Сообщений пока нет" description={emptyDescription} />
      </div>
    );
  }

  return (
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
  );
}
