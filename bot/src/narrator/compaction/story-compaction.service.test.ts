import { HttpException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const chatCompletion = vi.hoisted(() => vi.fn());
vi.mock("../../llm/client.js", () => ({ chatCompletion }));
const plan = vi.hoisted(() => ({ compactBlockReason: vi.fn(), planStoryCompaction: vi.fn() }));
vi.mock("./story-compaction-plan.js", async (importOriginal) => ({ ...(await importOriginal<object>()), ...plan }));
vi.mock("../generation/story-completion.js", () => ({ buildStoryCompletion: () => ({ msgs: [], compactComponentEnabled: true }) }));

const { MissingApiKeyError } = await import("../../llm/errors.js");
const { StoryCompactionService } = await import("./story-compaction.service.js");
type A = ConstructorParameters<typeof StoryCompactionService>;

const CTX = { story: { id: 5 }, template: null, preset: { reasoningEffort: "high" }, settings: { compactWords: 100 }, compactions: [] };
const seg = (anchorId: number) => ({ anchorId, beatTexts: [`b${anchorId}`], coveredCount: 2, coveredTokens: 50 });

function setup() {
  const access = { requireContext: vi.fn().mockResolvedValue(CTX) };
  const compactions = { nextSeq: vi.fn().mockResolvedValue(3), insert: vi.fn() };
  const service = new StoryCompactionService(access as unknown as A[0], compactions as unknown as A[1]);
  return { service, access, compactions };
}

const httpError = async (p: Promise<unknown>) => {
  const err = (await p.catch((e: unknown) => e)) as HttpException;
  expect(err).toBeInstanceOf(HttpException);
  return { status: err.getStatus(), body: err.getResponse() };
};

describe("StoryCompactionService.compact", () => {
  beforeEach(() => {
    chatCompletion.mockReset().mockImplementation(async () => ({ content: " пересказ " }));
    plan.compactBlockReason.mockReset().mockReturnValue(null);
    plan.planStoryCompaction.mockReset().mockReturnValue({ floor: 1000, chain: [{ toAnchorId: 2, summary: "старый" }], segments: [seg(4), seg(8)] });
  });

  it("сегменты по очереди: цепочка якорей и seq продолжают существующие, прошлые пересказы — в запросе", async () => {
    const { service, compactions } = setup();
    expect(await service.compact(1, 5)).toBe(2);
    expect(compactions.insert.mock.calls.map((c) => c[2])).toEqual([
      { seq: 3, fromAnchorId: 2, toAnchorId: 4, summary: "пересказ", coveredCount: 2, coveredTokens: 50 },
      { seq: 4, fromAnchorId: 4, toAnchorId: 8, summary: "пересказ", coveredCount: 2, coveredTokens: 50 },
    ]);
    const second = chatCompletion.mock.calls[1]![0];
    expect(second.messages[1].content).toContain("старый");
    expect(second.messages[1].content).toContain("пересказ");
    expect(second).toMatchObject({ requestReasoning: true, reasoningEffort: "high", debugLabel: "compact" });
  });

  it("сжимать нечего — 0 без вызовов LLM", async () => {
    const { service } = setup();
    plan.planStoryCompaction.mockReturnValueOnce({ floor: 1000, chain: [], segments: [] });
    expect(await service.compact(1, 5)).toBe(0);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("второе сжатие той же истории, пока идёт первое — 409 busy; после — снова можно", async () => {
    const { service } = setup();
    let release!: () => void;
    chatCompletion.mockImplementationOnce(() => new Promise((r) => (release = () => r({ content: "x" }))));
    const first = service.compact(1, 5);
    await vi.waitFor(() => expect(chatCompletion).toHaveBeenCalled());
    expect(await httpError(service.compact(1, 5))).toEqual({ status: 409, body: expect.objectContaining({ message: "busy" }) });
    release();
    await first;
    await expect(service.compact(1, 5)).resolves.toBe(2);
  });

  it("гейт закрыт — 409 с причиной; истории нет — 404 not_found (тела Hono-версии)", async () => {
    const { service, access } = setup();
    plan.compactBlockReason.mockReturnValueOnce("gate_off");
    expect((await httpError(service.compact(1, 5))).body).toMatchObject({ message: "gate_off" });
    access.requireContext.mockRejectedValueOnce(new NotFoundException("Story not found"));
    expect(await httpError(service.compact(1, 5))).toMatchObject({ status: 404, body: { message: "not_found" } });
  });

  it("нет ключа DeepSeek — 400 no_api_key без ретраев; блокировка снята", async () => {
    const { service } = setup();
    chatCompletion.mockRejectedValue(new MissingApiKeyError());
    expect(await httpError(service.compact(1, 5))).toMatchObject({ status: 400, body: { error: "no_api_key" } });
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    chatCompletion.mockReset().mockResolvedValue({ content: "x" });
    await expect(service.compact(1, 5)).resolves.toBe(2);
  });
});
