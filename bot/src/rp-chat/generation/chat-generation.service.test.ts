import { HttpException, type MessageEvent, NotFoundException } from "@nestjs/common";
import type { Observable } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const streamCompletion = vi.hoisted(() => vi.fn());
vi.mock("../../common/stream-completion.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  streamCompletion,
}));

const { MissingApiKeyError } = await import("../../llm/errors.js");
const { ChatGenerationService } = await import("./chat-generation.service.js");
type Args = ConstructorParameters<typeof ChatGenerationService>;

const CTX = {
  chat: { activeMessageId: 10, messages: [] },
  character: { name: "Рыцарь", prompt: "", scenario: "" },
  persona: null,
  template: null,
  preset: null,
};
const msg = (id: number, role: "user" | "assistant", parentId: number | null, content = `m${id}`) => ({ id, role, parentId, content, chatId: 5 });

function setup() {
  const calls: string[] = [];
  let nextId = 100;
  const access = {
    requireContext: vi.fn(async () => (calls.push("context"), CTX)),
    requireMessage: vi.fn(),
  };
  const messages = {
    insert: vi.fn(async (_u: number, _c: number, parentId: number | null, role: string, content: string) => {
      calls.push(`insert:${role}`);
      return { id: nextId++, parentId, role, content };
    }),
    findOne: vi.fn(),
    setCursor: vi.fn(async (_c: number, id: number | null) => void calls.push(`setCursor:${id}`)),
    moveCursorToLeaf: vi.fn(async (_c: number, id: number) => void calls.push(`leaf:${id}`)),
  };
  const service = new ChatGenerationService(access as unknown as Args[0], messages as unknown as Args[1], {} as Args[2]);
  return { service, access, messages, calls };
}

function collect(obs: Observable<MessageEvent>) {
  return new Promise<{ type: string; data: unknown }[]>((resolve) => {
    const events: { type: string; data: unknown }[] = [];
    obs.subscribe({
      next: (e) => events.push({ type: e.type!, data: JSON.parse(e.data as string) }),
      complete: () => resolve(events),
    });
  });
}

/** Последняя user-реплика в запросе к LLM — проверка, что реплика игрока ровно одна и та, что надо. */
const userTurns = () =>
  (streamCompletion.mock.lastCall?.[2].messages as { role: string; content: string }[]).filter((m) => m.role === "user");

describe("ChatGenerationService.send", () => {
  beforeEach(() => streamCompletion.mockReset().mockResolvedValue({ content: "Ответ" }));

  it("реплика под курсором → userMessage → ответ ИИ под ней, курсор на ответ → done", async () => {
    const { service, messages } = setup();
    const events = await collect(await service.send(1, 5, "Привет"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "done"]);
    expect(messages.insert).toHaveBeenNthCalledWith(1, 1, 5, 10, "user", "Привет");
    expect(messages.insert).toHaveBeenNthCalledWith(2, 1, 5, 100, "assistant", "Ответ");
    expect(messages.moveCursorToLeaf).toHaveBeenCalledWith(5, 101);
    expect(userTurns().map((m) => m.content)).toEqual(["Привет"]);
  });

  it("нет ключа — событие error с подсказкой, ответ не сохраняется", async () => {
    const { service, messages } = setup();
    streamCompletion.mockRejectedValueOnce(new MissingApiKeyError());
    const events = await collect(await service.send(1, 5, "Привет"));
    expect(events).toEqual([
      { type: "userMessage", data: expect.anything() },
      { type: "error", data: { message: new MissingApiKeyError().message } },
    ]);
    expect(messages.insert).toHaveBeenCalledTimes(1);
  });

  it("чужой чат — 404 до открытия потока, ничего не пишется", async () => {
    const { service, access, messages } = setup();
    access.requireContext.mockRejectedValueOnce(new NotFoundException("Chat not found"));
    await expect(service.send(1, 5, "x")).rejects.toBeInstanceOf(HttpException);
    expect(messages.insert).not.toHaveBeenCalled();
  });
});

describe("ChatGenerationService.edit", () => {
  beforeEach(() => streamCompletion.mockReset().mockResolvedValue({ content: "Новый ответ" }));

  it("ответ ИИ — сиблинг без генерации, поток только с done", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 20 }, msg: msg(20, "assistant", 19) });
    const events = await collect(await service.edit(1, 5, 20, "Исправлено"));
    expect(events).toEqual([{ type: "done", data: expect.objectContaining({ id: 100, content: "Исправлено" }) }]);
    expect(messages.insert).toHaveBeenCalledWith(1, 5, 19, "assistant", "Исправлено");
    expect(messages.moveCursorToLeaf).toHaveBeenCalledWith(5, 100);
    expect(streamCompletion).not.toHaveBeenCalled();
  });

  it("реплика игрока — курсор на родителя, контекст, потом новый сиблинг; ответ под ним", async () => {
    const { service, access, calls } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 21 }, msg: msg(20, "user", 19) });
    const events = await collect(await service.edit(1, 5, 20, "Иначе"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "done"]);
    expect(calls).toEqual(["setCursor:19", "context", "insert:user", "insert:assistant", "leaf:101"]);
    expect(userTurns().map((m) => m.content)).toEqual(["Иначе"]);
  });

  it("сбой генерации — курсор возвращается на новую реплику", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 21 }, msg: msg(20, "user", 19) });
    streamCompletion.mockRejectedValueOnce(new Error("boom"));
    const events = await collect(await service.edit(1, 5, 20, "Иначе"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "error"]);
    expect(messages.setCursor).toHaveBeenLastCalledWith(5, 100);
  });

  it("чат не собрался — 404 наружу, курсор на прежнем месте, реплика не вставлена", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 21 }, msg: msg(20, "user", 19) });
    access.requireContext.mockRejectedValueOnce(new NotFoundException("Chat not found"));
    await expect(service.edit(1, 5, 20, "Иначе")).rejects.toBeInstanceOf(NotFoundException);
    expect(messages.setCursor).toHaveBeenLastCalledWith(5, 21);
    expect(messages.insert).not.toHaveBeenCalled();
  });
});

describe("ChatGenerationService.regenerate", () => {
  beforeEach(() => streamCompletion.mockReset().mockResolvedValue({ content: "Ещё ответ" }));

  it("на ответ ИИ — отвечаем на его родительскую реплику; курсор выше неё", async () => {
    const { service, access, messages, calls } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 21 }, msg: msg(21, "assistant", 20) });
    messages.findOne.mockResolvedValue(msg(20, "user", 19, "Вопрос"));
    const events = await collect(await service.regenerate(1, 5, 21));
    expect(events.map((e) => e.type)).toEqual(["done"]);
    expect(calls).toEqual(["setCursor:19", "context", "insert:assistant", "leaf:100"]);
    expect(messages.insert).toHaveBeenCalledWith(1, 5, 20, "assistant", "Ещё ответ");
    expect(userTurns().map((m) => m.content)).toEqual(["Вопрос"]);
  });

  it("на реплику игрока — первый ответ на неё; курсор над корнем — null", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 20 }, msg: msg(20, "user", null, "Вопрос") });
    await collect(await service.regenerate(1, 5, 20));
    expect(messages.setCursor).toHaveBeenCalledWith(5, null);
    expect(messages.insert).toHaveBeenCalledWith(1, 5, 20, "assistant", "Ещё ответ");
  });

  it("сбой генерации — курсор ровно туда, где стоял (выбранный ответ, а не самый свежий сиблинг)", async () => {
    const { service, access, messages } = setup();
    // Курсор на старом ответе 21, хотя у реплики 20 есть более свежий ответ — откат не должен спуститься к нему.
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 21 }, msg: msg(21, "assistant", 20) });
    messages.findOne.mockResolvedValue(msg(20, "user", 19, "Вопрос"));
    streamCompletion.mockRejectedValueOnce(new Error("boom"));
    const events = await collect(await service.regenerate(1, 5, 21));
    expect(events.map((e) => e.type)).toEqual(["error"]);
    expect(messages.setCursor).toHaveBeenLastCalledWith(5, 21);
    expect(messages.moveCursorToLeaf).not.toHaveBeenCalled();
  });

  it("стартовое приветствие (нет родителя) — 404, курсор не трогаем", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 1 }, msg: msg(1, "assistant", null) });
    const err = await service.regenerate(1, 5, 1).catch((e: unknown) => e);
    expect((err as HttpException).message).toBe("Parent user message not found");
    expect(messages.setCursor).not.toHaveBeenCalled();
  });

  it("контекст не собрался после подъёма курсора — курсор на прежнее место, 404 наружу", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue({ chat: { activeMessageId: 22 }, msg: msg(20, "user", 19) });
    access.requireContext.mockRejectedValueOnce(new NotFoundException("Chat not found"));
    await expect(service.regenerate(1, 5, 20)).rejects.toBeInstanceOf(NotFoundException);
    expect(messages.setCursor).toHaveBeenLastCalledWith(5, 22);
  });
});
