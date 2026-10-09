import type { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { StoryMessagesService } = await import("./story-messages.service.js");
type A = ConstructorParameters<typeof StoryMessagesService>;

const msg = (over: object) => ({ id: 9, parentId: 8, role: "assistant", kind: "beat", content: "Бит", translations: null, storyChatId: 5, ...over });

function setup(found: object) {
  const messages = {
    setCursor: vi.fn(),
    updateContent: vi.fn().mockResolvedValue({ content: "Новый", translations: null }),
    removeSubtree: vi.fn().mockResolvedValue(true),
  };
  const path = { newestChild: vi.fn().mockResolvedValue(null) };
  const access = { requireMessage: vi.fn().mockResolvedValue({ story: { id: 5 }, msg: msg(found) }) };
  const service = new StoryMessagesService(messages as unknown as A[0], path as unknown as A[1], access as unknown as A[2]);
  return { service, messages, path };
}

const httpError = async (p: Promise<unknown>) => {
  const err = (await p.catch((e: unknown) => e)) as HttpException;
  return { status: err.getStatus(), message: err.message };
};

describe("StoryMessagesService.switchBranch", () => {
  it("бит — курсор ровно на него", async () => {
    const { service, messages } = setup({});
    await service.switchBranch(1, 5, 9);
    expect(messages.setCursor).toHaveBeenCalledWith(5, 9);
  });

  it("директива — на её бит (самый свежий ребёнок), а не к глубокому листу", async () => {
    const { service, messages, path } = setup({ role: "user", kind: "directive" });
    path.newestChild.mockResolvedValueOnce(12);
    await service.switchBranch(1, 5, 9);
    expect(messages.setCursor).toHaveBeenCalledWith(5, 12);
  });

  it("висячий ход без бита — на родительский бит", async () => {
    const { service, messages } = setup({ role: "user", kind: "continue", parentId: 8 });
    await service.switchBranch(1, 5, 9);
    expect(messages.setCursor).toHaveBeenCalledWith(5, 8);
  });
});

describe("StoryMessagesService.editBeat / remove", () => {
  it("бит — новый текст, перевод сброшен", async () => {
    const { service, messages } = setup({});
    expect(await service.editBeat(1, 5, 9, "Новый")).toEqual({ content: "Новый", translations: null });
    expect(messages.updateContent).toHaveBeenCalledWith(1, 5, 9, "Новый");
  });

  it("директива — 400 Can only edit a beat", async () => {
    const { service, messages } = setup({ role: "user", kind: "directive" });
    expect(await httpError(service.editBeat(1, 5, 9, "x"))).toEqual({ status: 400, message: "Can only edit a beat" });
    expect(messages.updateContent).not.toHaveBeenCalled();
  });

  it("открытие (корень) — 400, поддерево не трогаем", async () => {
    const { service, messages } = setup({ parentId: null });
    expect(await httpError(service.remove(1, 5, 9))).toEqual({ status: 400, message: "Cannot delete the opening beat" });
    expect(messages.removeSubtree).not.toHaveBeenCalled();
  });

  it("обычный бит — удаляется с поддеревом", async () => {
    const { service, messages } = setup({});
    await service.remove(1, 5, 9);
    expect(messages.removeSubtree).toHaveBeenCalledWith(1, 5, 9);
  });
});
