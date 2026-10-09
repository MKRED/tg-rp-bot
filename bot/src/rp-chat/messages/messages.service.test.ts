import { HttpException, NotFoundException } from "@nestjs/common";
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
  function setup() {
    const messages = { setCursor: vi.fn(), removeSubtree: vi.fn().mockResolvedValue(true) };
    const access = { requireRow: vi.fn().mockResolvedValue(ROW), requireMessage: vi.fn().mockResolvedValue({ chat: ROW }) };
    type A = ConstructorParameters<typeof MessagesService>;
    return { service: new MessagesService(asArg<A[0]>(messages), asArg<A[1]>(access)), messages, access };
  }

  it("сообщение не этого чата — ошибка доступа, курсор не трогаем", async () => {
    const { service, messages, access } = setup();
    access.requireMessage.mockRejectedValueOnce(new NotFoundException("Message not found"));
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
