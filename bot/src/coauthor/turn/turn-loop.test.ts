import { describe, expect, it, vi } from "vitest";
import type { ResponsesCompleter, ResponsesRequestOptions, ResponsesResult } from "../../llm/responses/types.js";
import type { ToolCall } from "../../llm/types.js";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { runCoauthorTurn } = await import("./turn-loop.js");
const { emptyCoauthorState } = await import("./state.js");

const cards = [{ id: 1, name: "Elena", brief: "", images: [], blocks: [{ id: "fears", title: "Fears", format: "", content: "" }] }];

const call = (id: string, name: string, args: unknown): ToolCall => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});

/** Фейковая модель: отдаёт ответы по очереди и запоминает запросы. */
function fakeLlm(replies: ResponsesResult[]) {
  const requests: ResponsesRequestOptions[] = [];
  const llm: ResponsesCompleter = {
    respond: async (options) => {
      requests.push(options);
      return replies.shift() ?? { content: "fallback", model: "m" };
    },
  };
  return { llm, requests };
}

const params = (llm: ResponsesCompleter, state = emptyCoauthorState()) => {
  state.messages.push({ role: "user", content: "Fill Elena's fears" });
  return {
    llm,
    baseOptions: { userId: "u" },
    customPrompt: "",
    cards,
    state,
    webSearch: null,
    maxSearchRounds: 0,
    askUserEnabled: true,
    withImages: false,
    limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 2 },
  };
};

describe("runCoauthorTurn", () => {
  it("edit_block → правка, затем текст — ход завершён", async () => {
    const { llm, requests } = fakeLlm([
      { content: "", model: "m", toolCalls: [call("e1", "edit_block", { card_id: 1, block_id: "fears", content: "Storms" })], reasoningContent: "think" },
      { content: "Proposed.", model: "m" },
    ]);
    const p = params(llm);
    expect(await runCoauthorTurn(p)).toBe("done");
    expect(p.state.proposals).toHaveLength(1);
    expect(p.state.messages.at(-1)).toEqual({ role: "assistant", content: "Proposed." });
    // Живой reasoning уходит обратно во втором запросе хода — элементом перед вызовом.
    const input = requests[1]!.input;
    const reasoningAt = input.findIndex((i) => "type" in i && i.type === "reasoning" && i.content[0]!.text === "think");
    expect(reasoningAt).toBeGreaterThan(0);
    expect(input[reasoningAt + 1]).toMatchObject({ type: "function_call", call_id: "e1" });
  });

  it("ask_user вместе с edit_block — пауза, результат правки отложен", async () => {
    const { llm } = fakeLlm([
      {
        content: "",
        model: "m",
        toolCalls: [
          call("a1", "ask_user", { questions: [{ question: "Tone?" }] }),
          call("e1", "edit_block", { card_id: 1, block_id: "fears", content: "Storms" }),
        ],
      },
    ]);
    const p = params(llm);
    expect(await runCoauthorTurn(p)).toBe("questions");
    expect(p.state.pending?.toolCallId).toBe("a1");
    expect(JSON.parse(p.state.pending!.results.e1!).ok).toBe(true);
    expect(p.state.messages.at(-1)!.role).toBe("assistant");
  });

  it("выключенный ask_user — ошибка в результате, без паузы", async () => {
    const { llm } = fakeLlm([
      { content: "", model: "m", toolCalls: [call("a1", "ask_user", { questions: [{ question: "Tone?" }] })] },
      { content: "ok", model: "m" },
    ]);
    const p = { ...params(llm), askUserEnabled: false };
    expect(await runCoauthorTurn(p)).toBe("done");
    const result = p.state.messages.find((m) => m.role === "tool");
    expect(result && JSON.parse(result.content).error).toContain("unavailable");
  });

  it("модель зовёт инструменты бесконечно — последний раунд без tools", async () => {
    const loop = Array.from({ length: 20 }, (_, i) => ({
      content: "",
      model: "m",
      toolCalls: [call(`g${i}`, "get_cards", {})],
    }));
    const { llm, requests } = fakeLlm(loop);
    const p = params(llm);
    expect(await runCoauthorTurn(p)).toBe("done");
    expect(requests).toHaveLength(8);
    expect(requests.at(-1)!.tools).toBeUndefined();
  });

  it("шаг объявляется по дельтам один раз и завершается итоговым статусом", async () => {
    const args = JSON.stringify({ card_id: 1, block_id: "fears", content: "Storms" });
    const steps: unknown[] = [];
    const replies: ResponsesResult[] = [
      { content: "", model: "m", toolCalls: [call("e1", "edit_block", { card_id: 1, block_id: "fears", content: "Storms" })] },
      { content: "Ok", model: "m" },
    ];
    const llm: ResponsesCompleter = {
      respond: async (_options, _onChunk, _onReset, onToolCall) => {
        // Две дельты после того, как id уже читаются: шаг не должен задвоиться.
        onToolCall?.({ id: "e1", name: "edit_block", arguments: args.slice(0, -5) });
        onToolCall?.({ id: "e1", name: "edit_block", arguments: args });
        return replies.shift()!;
      },
    };
    const p = params(llm);
    let proposalsAtDone = -1;
    await runCoauthorTurn({
      ...p,
      onStep: (step) => {
        steps.push(step);
        if (step.status === "done") proposalsAtDone = p.state.proposals.length;
      },
    });
    expect(steps).toEqual([
      { id: "e1", status: "running", kind: "edit", cardId: 1, blockId: "fears" },
      { id: "e1", status: "done", kind: "edit", cardId: 1, blockId: "fears" },
    ]);
    // Клиент берёт снимок правок в момент шага done — правка уже должна быть там.
    expect(proposalsAtDone).toBe(1);
  });

  it("ответ оборван лимитом — последний вызов не выполняется, модель узнаёт причину", async () => {
    const { llm } = fakeLlm([
      {
        content: "",
        model: "m",
        incompleteReason: "max_output_tokens",
        toolCalls: [
          call("e1", "edit_block", { card_id: 1, block_id: "fears", content: "Storms" }),
          { id: "e2", type: "function", function: { name: "edit_block", arguments: '{"card_id": 1, "block_id": "fears", "content": "Sto' } },
        ],
      },
      { content: "Ok", model: "m" },
    ]);
    const p = params(llm);
    expect(await runCoauthorTurn(p)).toBe("done");
    const results = p.state.messages.filter((m) => m.role === "tool");
    expect(JSON.parse(results[0]!.content).ok).toBe(true);
    expect(JSON.parse(results[1]!.content).error).toContain("token limit");
  });

  it("без дельт шаг всё равно появляется, ошибка инструмента — failed", async () => {
    const steps: Array<{ status: string }> = [];
    const { llm } = fakeLlm([
      { content: "", model: "m", toolCalls: [call("e1", "edit_block", { card_id: 99, block_id: "x", content: "y" })] },
      { content: "Ok", model: "m" },
    ]);
    await runCoauthorTurn({ ...params(llm), onStep: (step) => steps.push(step) });
    expect(steps.map((s) => s.status)).toEqual(["running", "failed"]);
  });
});

describe("runCoauthorTurn — apply_patch и лимиты", () => {
  const sisters = [
    { id: 3, name: "Lira", brief: "", images: [], blocks: [{ id: "main", title: "Main", format: "", content: "- Eyes: green" }] },
    { id: 4, name: "Ada", brief: "", images: [], blocks: [{ id: "main", title: "Main", format: "", content: "- Eyes: green too" }] },
  ];
  const patchCall = (id: string, input: string): ToolCall => ({ id, type: "custom", function: { name: "apply_patch", arguments: input } });
  const both =
    "*** Begin Patch\n*** Update File: cards/3/main.md\n@@\n-- Eyes: green\n+- Eyes: grey\n" +
    "*** Update File: cards/4/main.md\n@@\n-- Eyes: green too\n+- Eyes: grey too\n*** End Patch";

  it("патч на две карточки — две правки, шаг на каждый блок, остаток бюджета в результате", async () => {
    const { llm, requests } = fakeLlm([
      { content: "", model: "m", toolCalls: [patchCall("p1", both)] },
      { content: "Done.", model: "m" },
    ]);
    const steps: Array<{ id: string; status: string }> = [];
    const p = { ...params(llm), cards: sisters, onStep: (s: { id: string; status: string }) => steps.push(s) };
    expect(await runCoauthorTurn(p)).toBe("done");
    expect(p.state.proposals.map((x) => x.content)).toEqual(["- Eyes: grey", "- Eyes: grey too"]);
    expect(steps.map((s) => `${s.id}:${s.status}`)).toEqual(["p1:3:main:running", "p1:4:main:running", "p1:3:main:done", "p1:4:main:done"]);
    const result = JSON.parse(p.state.messages.find((m) => m.role === "tool")!.content);
    expect(result).toMatchObject({ ok: true, edits_left: 22, rounds_left: 6 });
    // Результат custom-вызова уходит модели парой custom_tool_call / custom_tool_call_output.
    expect(requests[1]!.input.filter((i) => "type" in i).map((i) => (i as { type: string }).type).slice(-2))
      .toEqual(["custom_tool_call", "custom_tool_call_output"]);
  });

  it("лимит правок: лишняя правка отвечает модели ошибкой, а не пропадает молча", async () => {
    const { llm } = fakeLlm([
      {
        content: "",
        model: "m",
        toolCalls: [
          call("e1", "edit_block", { card_id: 1, block_id: "fears", content: "Storms" }),
          call("e2", "edit_block", { card_id: 1, block_id: "fears", content: "Deep water" }),
        ],
      },
      { content: "One left for later.", model: "m" },
    ]);
    const p = { ...params(llm), limits: { maxRounds: 8, maxEdits: 1, maxQuestions: 2 } };
    await runCoauthorTurn(p);
    const results = p.state.messages.filter((m) => m.role === "tool").map((m) => JSON.parse(m.content));
    expect(results[0]).toMatchObject({ ok: true, edits_left: 0 });
    expect(results[1].error).toContain("edit limit");
    expect(p.state.proposals).toHaveLength(1);
  });

  it("лимит вопросов: сверх лимита ask_user — ошибка без паузы", async () => {
    const { llm } = fakeLlm([
      { content: "", model: "m", toolCalls: [call("a1", "ask_user", { questions: [{ question: "Tone?" }] })] },
      { content: "ok", model: "m" },
    ]);
    const p = { ...params(llm), limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 1 } };
    // Один вопрос в этом ходе уже был.
    p.state.messages.push(
      { role: "assistant", content: null, toolCalls: [call("a0", "ask_user", { questions: [{ question: "Name?" }] })] },
      { role: "tool", toolCallId: "a0", content: '{"answers":[]}' },
    );
    expect(await runCoauthorTurn(p)).toBe("done");
    const last = p.state.messages.filter((m) => m.role === "tool").at(-1)!;
    expect(JSON.parse(last.content).error).toContain("ask_user limit");
  });

  it("лимит раундов из настроек чата", async () => {
    const loop = Array.from({ length: 5 }, (_, i) => ({ content: "", model: "m", toolCalls: [call(`g${i}`, "get_cards", {})] }));
    const { llm, requests } = fakeLlm(loop);
    await runCoauthorTurn({ ...params(llm), limits: { maxRounds: 3, maxEdits: 24, maxQuestions: 2 } });
    expect(requests).toHaveLength(3);
    expect(requests.at(-1)!.tools).toBeUndefined();
  });
});
