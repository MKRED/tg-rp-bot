import type { StoryMessage } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import type { CompactionRow } from "./compactions.repository.js";
import { splitByCompactions } from "./live-tail.js";

const msg = (id: number) => ({ id }) as StoryMessage;
const path = [1, 2, 3, 4, 5].map(msg);
const comp = (id: number, fromAnchorId: number | null, toAnchorId: number) =>
  ({ id, seq: id, fromAnchorId, toAnchorId, summary: `s${id}`, coveredCount: 0, coveredTokens: 0, createdAt: "" }) as CompactionRow;

describe("splitByCompactions", () => {
  it("без пересказов — весь путь живой", () => {
    expect(splitByCompactions(path, [])).toEqual({ chain: [], liveTail: path });
  });

  it("цепочка из двух — хвост после последнего якоря", () => {
    const { chain, liveTail } = splitByCompactions(path, [comp(1, null, 2), comp(2, 2, 3)]);
    expect(chain.map((c) => c.id)).toEqual([1, 2]);
    expect(liveTail.map((m) => m.id)).toEqual([4, 5]);
  });

  it("пересказ другой ветки (якорь не на пути) — не применяется", () => {
    const { chain, liveTail } = splitByCompactions(path, [comp(1, null, 2), comp(2, 2, 99)]);
    expect(chain.map((c) => c.id)).toEqual([1]);
    expect(liveTail.map((m) => m.id)).toEqual([3, 4, 5]);
  });
});
