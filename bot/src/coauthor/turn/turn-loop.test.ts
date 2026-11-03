import { describe, expect, it, vi } from "vitest";
import type { ChatCompleter, ChatCompletionOptions, ChatCompletionResult, ToolCall } from "../../llm/types.js";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { runCoauthorTurn, COAUTHOR_MAX_LLM_ROUNDS } = await import("./turn-loop.js");
const { emptyCoauthorState } = await import("./state.js");

const cards = [{ id: 1, name: "Elena", brief: "", blocks: [{ id: "fears", title: "Fears", format: "", content: "" }] }];

const call = (id: string, name: string, args: unknown): ToolCall => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});

/** Фейковая модель: отдаёт ответы по очереди и запоминает запросы. */
function fakeLlm(replies: ChatCompletionResult[]) {
  const requests: ChatCompletionOptions[] = [];
  const llm: ChatCompleter = {
    complete: async (options) => {
      requests.push(options);
      return replies.shift() ?? { content: "fallback", model: "m" };
    },
  };
  return { llm, requests };
}

const params = (llm: ChatCompleter, state = emptyCoauthorState()) => {
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
    // Живой reasoning уходит обратно во втором запросе хода.
    expect(requests[1]!.messages.some((m) => "reasoning_content" in m && m.reasoning_content === "think")).toBe(true);
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
    expect(requests).toHaveLength(COAUTHOR_MAX_LLM_ROUNDS);
    expect(requests.at(-1)!.tools).toBeUndefined();
  });
});
