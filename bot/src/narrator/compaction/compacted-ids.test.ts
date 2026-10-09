import { describe, expect, it } from "vitest";
import { collectCompactedIds } from "./compacted-ids.js";

// Дерево: 1 → 2 → 3 → 4 → 5, и ветка 3 → 6 → 7.
const rows = [
  { id: 1, parentId: null },
  { id: 2, parentId: 1 },
  { id: 3, parentId: 2 },
  { id: 4, parentId: 3 },
  { id: 5, parentId: 4 },
  { id: 6, parentId: 3 },
  { id: 7, parentId: 6 },
];

describe("collectCompactedIds", () => {
  it("первый пересказ — от корня до якоря включительно", () => {
    expect([...collectCompactedIds([{ fromAnchorId: null, toAnchorId: 3 }], rows)].sort()).toEqual([1, 2, 3]);
  });

  it("следующий пересказ — после предыдущего якоря, только своя ветка", () => {
    const ids = collectCompactedIds(
      [
        { fromAnchorId: null, toAnchorId: 2 },
        { fromAnchorId: 2, toAnchorId: 7 },
      ],
      rows,
    );
    expect([...ids].sort()).toEqual([1, 2, 3, 6, 7]);
  });

  it("нет пересказов — ничего не свёрнуто", () => {
    expect(collectCompactedIds([], rows).size).toBe(0);
  });
});
