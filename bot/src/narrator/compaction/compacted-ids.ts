/** Якоря пересказа: диапазон (fromAnchorId, toAnchorId] по цепочке parentId. */
export type CompactionAnchors = { fromAnchorId: number | null; toAnchorId: number };

/**
 * Сообщения, попавшие в диапазон (fromAnchorId, toAnchorId] какого-то пересказа — структурно,
 * по цепочке parentId (якоря ссылаются на конкретные id, не зависят от того, какая ветка активна
 * сейчас). Так подсвечиваем на графе именно ту ветку, где реально было сжатие.
 */
export function collectCompactedIds(
  anchors: CompactionAnchors[],
  rows: { id: number; parentId: number | null }[],
): Set<number> {
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
  const compacted = new Set<number>();
  for (const { fromAnchorId, toAnchorId } of anchors) {
    let cur: number | null = toAnchorId;
    while (cur !== null && cur !== fromAnchorId) {
      compacted.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }
  return compacted;
}
