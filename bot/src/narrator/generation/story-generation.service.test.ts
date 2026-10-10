import { HttpException, type MessageEvent, NotFoundException } from "@nestjs/common";
import type { Observable } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const streamCompletion = vi.hoisted(() => vi.fn());
vi.mock("../../common/stream-completion.js", async (importOriginal) => ({ ...(await importOriginal<object>()), streamCompletion }));
const needsAutoCompaction = vi.hoisted(() => vi.fn());
vi.mock("../compaction/story-compaction-plan.js", () => ({ needsAutoCompaction }));
vi.mock("./story-completion.js", () => ({ buildStoryCompletion: () => ({ msgs: [{ role: "user", content: "ход" }], samplingOpts: {}, compactComponentEnabled: true }) }));

const { StoryGenerationService } = await import("./story-generation.service.js");
type A = ConstructorParameters<typeof StoryGenerationService>;

const ROW = { id: 5, activeMessageId: 10, templateId: 2, presetId: 3, bookId: 1 };
const CTX = { story: { id: 5 } };

function setup() {
  const calls: string[] = [];
  let nextId = 100;
  const access = {
    requireRow: vi.fn().mockResolvedValue(ROW),
    requireMessage: vi.fn(),
    requireContext: vi.fn(async () => (calls.push("context"), CTX)),
  };
  const messages = {
    insert: vi.fn(async (_u: number, _s: number, parentId: number, role: string, kind: string, content: string) => {
      calls.push(`insert:${kind}`);
      return { id: nextId++, parentId, role, kind, content };
    }),
    setCursor: vi.fn(async (_s: number, id: number | null) => void calls.push(`setCursor:${id}`)),
    moveCursorToLeaf: vi.fn(async (_s: number, id: number) => void calls.push(`leaf:${id}`)),
    removeSubtree: vi.fn(async (_u: number, _s: number, id: number) => (calls.push(`remove:${id}`), true)),
  };
  const templates = { findOne: vi.fn().mockResolvedValue({ continueMarker: "[Дальше!]", leadingUserMarker: "" }) };
  const compaction = { compact: vi.fn(async () => (calls.push("compact"), 1)) };
  const service = new StoryGenerationService(
    access as unknown as A[0],
    messages as unknown as A[1],
    templates as unknown as A[2],
    compaction as unknown as A[3],
  );
  return { service, access, messages, templates, compaction, calls };
}

function collect(obs: Observable<MessageEvent>) {
  return new Promise<{ type: string; data: unknown }[]>((resolve) => {
    const events: { type: string; data: unknown }[] = [];
    obs.subscribe({ next: (e) => events.push({ type: e.type!, data: JSON.parse(e.data as string) }), complete: () => resolve(events) });
  });
}

const httpError = async (p: Promise<unknown>) => {
  const err = (await p.catch((e: unknown) => e)) as HttpException;
  expect(err).toBeInstanceOf(HttpException);
  return { status: err.getStatus(), message: err.message };
};

beforeEach(() => {
  streamCompletion.mockReset().mockResolvedValue({ content: "Бит" });
  needsAutoCompaction.mockReset().mockReturnValue(false);
});

describe("StoryGenerationService.advance", () => {
  it("директива — ход под последним битом, курсор на ход, бит под ходом → userMessage, done", async () => {
    const { service, messages, calls } = setup();
    const events = await collect(await service.advance(1, 5, "рыцарь входит"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "done"]);
    expect(messages.insert).toHaveBeenNthCalledWith(1, 1, 5, 10, "user", "directive", "рыцарь входит");
    expect(calls).toEqual(["insert:directive", "setCursor:100", "context", "insert:beat", "leaf:101"]);
  });

  it("пусто — continue с маркером шаблона истории", async () => {
    const { service, messages } = setup();
    await collect(await service.advance(1, 5, ""));
    expect(messages.insert).toHaveBeenNthCalledWith(1, 1, 5, 10, "user", "continue", "[Дальше!]");
  });

  it("нет курсора — 400 до потока; чужая история — 404", async () => {
    const { service, access, messages } = setup();
    access.requireRow.mockResolvedValueOnce({ ...ROW, activeMessageId: null });
    expect(await httpError(service.advance(1, 5, "x"))).toEqual({ status: 400, message: "Story has no active beat" });
    access.requireRow.mockRejectedValueOnce(new NotFoundException("Story not found"));
    expect((await httpError(service.advance(1, 5, "x"))).status).toBe(404);
    expect(messages.insert).not.toHaveBeenCalled();
  });

  it("сбой генерации — висящий ход удаляется, событие error", async () => {
    const { service, messages } = setup();
    streamCompletion.mockRejectedValueOnce(new Error("boom"));
    const events = await collect(await service.advance(1, 5, "x"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "error"]);
    expect(messages.removeSubtree).toHaveBeenCalledWith(1, 5, 100);
  });

  it("авто-сжатие: статус в ленте, сжатие, контекст перечитан до генерации", async () => {
    const { service, calls } = setup();
    needsAutoCompaction.mockReturnValueOnce(true);
    const events = await collect(await service.advance(1, 5, "x"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "status", "done"]);
    expect(events[1]!.data).toEqual({ phase: "compacting" });
    expect(calls).toEqual(["insert:directive", "setCursor:100", "context", "compact", "context", "insert:beat", "leaf:101"]);
  });

  it("сбой авто-сжатия генерацию не роняет; контекст перечитан (часть пересказов могла записаться)", async () => {
    const { service, compaction, calls } = setup();
    needsAutoCompaction.mockReturnValueOnce(true);
    compaction.compact.mockRejectedValueOnce(new Error("segment 2 failed"));
    const events = await collect(await service.advance(1, 5, "x"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "status", "done"]);
    expect(calls.filter((c) => c === "context")).toHaveLength(2);
  });

  it("сбой проверки авто-сжатия — без сжатия, генерация идёт", async () => {
    const { service, compaction } = setup();
    needsAutoCompaction.mockImplementationOnce(() => {
      throw new Error("bad preset");
    });
    const events = await collect(await service.advance(1, 5, "x"));
    expect(events.map((e) => e.type)).toEqual(["userMessage", "done"]);
    expect(compaction.compact).not.toHaveBeenCalled();
  });
});

describe("StoryGenerationService.regenerate", () => {
  const beat = (over: object = {}) => ({ story: ROW, msg: { id: 12, role: "assistant", kind: "beat", parentId: 11, ...over } });

  it("бит — курсор на его ход, новый бит-сиблинг под ходом", async () => {
    const { service, access, messages, calls } = setup();
    access.requireMessage.mockResolvedValue(beat());
    const events = await collect(await service.regenerate(1, 5, 12));
    expect(events.map((e) => e.type)).toEqual(["done"]);
    expect(calls).toEqual(["setCursor:11", "context", "insert:beat", "leaf:100"]);
    expect(messages.insert).toHaveBeenCalledWith(1, 5, 11, "assistant", "beat", "Бит");
  });

  it.each([
    { over: { role: "user", kind: "directive" }, message: "Can only regenerate a beat" },
    { over: { parentId: null }, message: "Cannot regenerate the opening beat" },
  ])("$message — 400, курсор не трогаем", async ({ over, message }) => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue(beat(over));
    expect(await httpError(service.regenerate(1, 5, 12))).toEqual({ status: 400, message });
    expect(messages.setCursor).not.toHaveBeenCalled();
  });

  it("сбой генерации — курсор ровно туда, где стоял (не к свежему листу)", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue(beat());
    streamCompletion.mockRejectedValueOnce(new Error("boom"));
    const events = await collect(await service.regenerate(1, 5, 12));
    expect(events.map((e) => e.type)).toEqual(["error"]);
    expect(messages.setCursor).toHaveBeenLastCalledWith(5, 10);
    expect(messages.moveCursorToLeaf).not.toHaveBeenCalled();
  });

  it("контекст не собрался после подъёма курсора — курсор на место, 404 наружу", async () => {
    const { service, access, messages } = setup();
    access.requireMessage.mockResolvedValue(beat());
    access.requireContext.mockRejectedValueOnce(new NotFoundException("Story not found"));
    expect((await httpError(service.regenerate(1, 5, 12))).status).toBe(404);
    expect(messages.setCursor).toHaveBeenLastCalledWith(5, 10);
  });
});
