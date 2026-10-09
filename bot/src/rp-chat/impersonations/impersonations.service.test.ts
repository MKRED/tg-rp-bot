import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { ImpersonationsService } = await import("./impersonations.service.js");

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), message: (err as HttpException).message };
}

const asArg = <T>(v: unknown) => v as T;
const ROW = { id: 5, activeMessageId: 12, templateId: 3, presetId: 4 };

describe("ImpersonationsService", () => {
  it("список — для момента = курсора чата; удаление несуществующего — 404 Variant not found", async () => {
    const repo = { list: vi.fn().mockResolvedValue([]), remove: vi.fn().mockResolvedValue(false) };
    const access = { requireRow: vi.fn().mockResolvedValue(ROW) };
    type A = ConstructorParameters<typeof ImpersonationsService>;
    const service = new ImpersonationsService(asArg<A[0]>(repo), asArg<A[1]>(access));
    await service.list(1, 5);
    expect(repo.list).toHaveBeenCalledWith(1, 5, 12);
    expect(await httpError(service.remove(1, 5, 3))).toEqual({ status: 404, message: "Variant not found" });
  });
});
