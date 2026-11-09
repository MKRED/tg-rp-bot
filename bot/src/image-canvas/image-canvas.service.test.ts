import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../config.js", () => ({ config: { isProduction: false } }));

const { ImageCanvasService } = await import("./image-canvas.service.js");
type Service = InstanceType<typeof ImageCanvasService>;

function canvasRecord(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: "u1",
    name: "Холст",
    model: "qwen",
    prompt: "",
    referenceThumbs: [] as string[],
    genStatus: "idle",
    genPromptId: null,
    genStartedAt: null,
    genError: null,
    genRequest: null,
    updatedAt: new Date("2026-11-09T00:00:00Z"),
    ...over,
  };
}

function setup(state: { references?: string[]; thumbs?: string[]; canvases?: number; variants?: number } = {}) {
  let references = state.references ?? [];
  let thumbs = state.thumbs ?? references.map((_, i) => `thumb${i}`);
  const canvases = {
    count: vi.fn(async () => state.canvases ?? 0),
    create: vi.fn(async (_u: string, name: string) => canvasRecord({ name })),
    find: vi.fn(async () => canvasRecord({ referenceThumbs: thumbs })),
    findReferences: vi.fn(async () => [...references]),
    setReferences: vi.fn(async (_u: string, _id: number, refs: string[], t: string[]) => {
      references = refs;
      thumbs = t;
      return canvasRecord({ referenceThumbs: t });
    }),
    touch: vi.fn(async () => undefined),
  };
  const items = {
    list: vi.fn(async () => []),
    countVariants: vi.fn(async () => state.variants ?? 0),
    promoteDraft: vi.fn(async () => true),
    getImage: vi.fn(async () => ({ image: "data:variant", thumb: "variant-thumb" })),
  };
  const generation = { start: vi.fn(), cancel: vi.fn() };
  const service = new ImageCanvasService(canvases as never, items as never, generation as never) as Service;
  return { service, canvases, items, current: () => ({ references, thumbs }) };
}

async function status(promise: Promise<unknown>): Promise<number> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return (err as HttpException).getStatus();
}

const REF = { image: "data:image/png;base64,AA==", thumb: "data:image/jpeg;base64,AA==" };

describe("ImageCanvasService", () => {
  it("лимит холстов — 409", async () => {
    const { service } = setup({ canvases: 20 });
    expect(await status(service.create("u1"))).toBe(409);
  });

  it("новый холст без названия — «Новый холст»", async () => {
    const { service, canvases } = setup();
    await service.create("u1", "  ");
    expect(canvases.create).toHaveBeenCalledWith("u1", "Новый холст");
  });

  it("картинки: добавление в конец, замена, не больше трёх, без дыр", async () => {
    const { service, current } = setup({ references: ["a", "b"] });
    await service.setReference("u1", 1, 2, REF);
    expect(current().references).toEqual(["a", "b", REF.image]);
    await service.setReference("u1", 1, 0, { image: "z", thumb: "zt" });
    expect(current().references[0]).toBe("z");
    expect(await status(service.setReference("u1", 1, 3, REF))).toBe(400);
    const empty = setup();
    expect(await status(empty.service.setReference("u1", 1, 1, REF))).toBe(400);
  });

  it("удаление картинки сдвигает следующие вместе с миниатюрами", async () => {
    const { service, current } = setup({ references: ["a", "b", "c"] });
    await service.removeReference("u1", 1, 0);
    expect(current()).toEqual({ references: ["b", "c"], thumbs: ["thumb1", "thumb2"] });
  });

  it("перестановка картинок — вместе с миниатюрами; не перестановка текущих слотов — 400", async () => {
    const { service, current } = setup({ references: ["a", "b", "c"] });
    await service.reorderReferences("u1", 1, [2, 0, 1]);
    expect(current()).toEqual({ references: ["c", "a", "b"], thumbs: ["thumb2", "thumb0", "thumb1"] });
    expect(await status(service.reorderReferences("u1", 1, [0, 1]))).toBe(400);
    expect(await status(service.reorderReferences("u1", 1, [0, 0, 1]))).toBe(400);
  });

  it("«В работу» — вариант становится картинкой 1", async () => {
    const { service, current } = setup({ references: ["a", "b"] });
    await service.useVariant("u1", 1, 7);
    expect(current()).toEqual({ references: ["data:variant", "b"], thumbs: ["variant-thumb", "thumb1"] });
  });

  it("сохранение черновика упирается в лимит вариантов", async () => {
    const full = setup({ variants: 30 });
    expect(await status(full.service.saveDraft("u1", 1, 5, "t"))).toBe(409);
    const ok = setup({ variants: 3 });
    await ok.service.saveDraft("u1", 1, 5, "t");
    expect(ok.items.promoteDraft).toHaveBeenCalledWith("u1", 1, 5, "t");
    expect(ok.canvases.touch).toHaveBeenCalled();
  });

  it("пустое новое название — 400", async () => {
    const { service } = setup();
    expect(await status(service.update("u1", 1, { name: "  " }))).toBe(400);
  });
});
