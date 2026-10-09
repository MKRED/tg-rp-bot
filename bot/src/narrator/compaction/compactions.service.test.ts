import type { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { CompactionsService } = await import("./compactions.service.js");
type A = ConstructorParameters<typeof CompactionsService>;

const comp = (id: number, fromAnchorId: number | null, toAnchorId: number) => ({
  id,
  seq: id,
  fromAnchorId,
  toAnchorId,
  summary: `s${id}`,
  coveredCount: 2,
  coveredTokens: 20,
  createdAt: "",
});
const story = { id: 5, activeMessageId: 3, messages: [{ id: 1 }, { id: 2 }, { id: 3 }] };

function setup() {
  const compactions = { list: vi.fn().mockResolvedValue([comp(1, null, 2), comp(2, 2, 99)]), removeCascade: vi.fn().mockResolvedValue(true) };
  const stories = { findDetail: vi.fn().mockResolvedValue(story) };
  const access = { requireRow: vi.fn().mockResolvedValue({ id: 5 }) };
  const service = new CompactionsService(compactions as unknown as A[0], stories as unknown as A[1], access as unknown as A[2]);
  return { service, compactions, stories };
}

const message = async (p: Promise<unknown>) => ((await p.catch((e: unknown) => e)) as HttpException).message;

describe("CompactionsService", () => {
  it("список — только цепочка активной ветки, без якорей", async () => {
    const { service } = setup();
    expect(await service.listActive(1, 5)).toEqual([{ id: 1, seq: 1, summary: "s1", coveredCount: 2, coveredTokens: 20 }]);
  });

  it("история без курсора — пусто; чужая — 404", async () => {
    const { service, stories } = setup();
    stories.findDetail.mockResolvedValueOnce({ ...story, activeMessageId: null });
    expect(await service.listActive(1, 5)).toEqual([]);
    stories.findDetail.mockResolvedValueOnce(undefined);
    expect(await message(service.listActive(1, 5))).toBe("Story not found");
  });

  it("удаление чужого/несуществующего пересказа — 404 Compaction not found", async () => {
    const { service, compactions } = setup();
    compactions.removeCascade.mockResolvedValueOnce(false);
    expect(await message(service.remove(1, 5, 7))).toBe("Compaction not found");
  });
});
