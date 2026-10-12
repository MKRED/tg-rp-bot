import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NODE_W } from "../../../../shared/graph/treeLayout";
import type { TreeNode } from "../../types/chat";
import styles from "./ChatGraphNode.module.css";

export type ChatGraphNodeData = { node: TreeNode };

/** Длина превью сообщения в узле — остальное обрезает и CSS (две строки). */
const PREVIEW_LEN = 60;

/**
 * Узел графа веток RP-чата: кто пишет и начало сообщения; узлы активной ветки обведены акцентом.
 * Ширина — ровно NODE_W: раскладка (layoutTreeNodes) центрирует родителя над детьми, считая ширину
 * узлов одинаковой, а линии крепятся к центру узла — при плавающей ширине линии косят.
 */
export function ChatGraphNode({ data }: NodeProps<Node<ChatGraphNodeData>>) {
  const { node } = data;
  const preview = node.content.length > PREVIEW_LEN ? `${node.content.slice(0, PREVIEW_LEN)}…` : node.content;

  return (
    <div className={styles.node} data-active={node.isOnActivePath || undefined} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.role}>{node.role === "assistant" ? "ИИ" : "Вы"}</div>
      <div className={styles.text}>{preview}</div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
