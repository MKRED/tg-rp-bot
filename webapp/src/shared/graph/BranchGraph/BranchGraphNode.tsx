import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NODE_W } from "../treeLayout";
import styles from "./BranchGraph.module.css";

/** Что показывает узел: подпись (кто/что), начало текста и признаки. */
export type BranchNodeData = {
  label: string;
  text: string;
  active: boolean;
  /** Сообщение свёрнуто в пересказ (сжатие истории рассказчика). */
  compacted?: boolean;
};

/** Длина превью — остальное обрезает и CSS (две строки). */
const PREVIEW_LEN = 60;

/**
 * Узел графа веток: подпись и начало сообщения; узлы активной ветки обведены акцентом. Ширина — ровно
 * NODE_W: раскладка (layoutTreeNodes) центрирует родителя над детьми, считая ширину узлов одинаковой, а
 * линии крепятся к центру узла — при плавающей ширине линии косят.
 */
export function BranchGraphNode({ data }: NodeProps<Node<BranchNodeData>>) {
  const preview = data.text.length > PREVIEW_LEN ? `${data.text.slice(0, PREVIEW_LEN)}…` : data.text;

  return (
    <div
      className={styles.node}
      data-active={data.active || undefined}
      data-compacted={data.compacted || undefined}
      style={{ width: NODE_W }}
    >
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.role}>{data.label}</div>
      <div className={styles.text}>{preview}</div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
