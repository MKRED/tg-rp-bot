import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { MessagesService } = await import("./messages.service.js");

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), message: (err as HttpException).message };
}

const asArg = <T>(v: unknown) => v as T;
const ROW = { id: 5, activeMessageId: 12, templateId: 3, presetId: 4 };

describe("MessagesService", () => {
  function setup(msg: unknown = { id: 9, chatId: 5 }) {
    const messages = { findOne: vi.fn().mockResolvedValue(msg), setCursor: vi.fn(), removeSubtree: vi.fn().mockResolvedValue(true) };
    const access = { requireRow: vi.fn().mockResolvedValue(ROW) };
    type A = ConstructorParameters<typeof MessagesService>;
    return { service: new MessagesService(asArg<A[0]>(messages), asArg<A[1]>(access)), messages, access };
  }

  it("сообщение другого чата — 404 Message not found, курсор не трогаем", async () => {
    const { service, messages } = setup({ id: 9, chatId: 6 });
    expect(await httpError(service.switchBranch(1, 5, 9))).toEqual({ status: 404, message: "Message not found" });
    expect(messages.setCursor).not.toHaveBeenCalled();
  });

  it("branch — курсор ровно на узел; remove несуществующего — 404", async () => {
    const { service, messages } = setup();
    await service.switchBranch(1, 5, 9);
    expect(messages.setCursor).toHaveBeenCalledWith(5, 9);
    messages.removeSubtree.mockResolvedValueOnce(false);
    expect((await httpError(service.remove(1, 5, 9))).message).toBe("Message not found");
  });
});
