import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { runCardGenerationToolLoop } = await import("./tool-loop.js");
const { TavilyHttpError } = await import("../../tavily/errors.js");
type Params = Parameters<typeof runCardGenerationToolLoop>[0];

const searchCall = (query: string) => ({
  id: `call-${query}`,
  type: "function" as const,
  function: { name: "web_search", arguments: JSON.stringify({ query }) },
});

function setup(over: Partial<Params> = {}) {
  const llm = { complete: vi.fn() };
  const webSearch = { search: vi.fn().mockResolvedValue([{ title: "T", url: "u", content: "c" }]) };
  const params: Params = {
    llm,
    baseOptions: { userId: 1 },
    history: [{ role: "user", content: "сгенерируй блок" }],
    webSearch,
    maxSearchRounds: 3,
    askUserEnabled: false,
    ...over,
  };
  return { llm, webSearch, params };
}

describe("runCardGenerationToolLoop — веб-поиск", () => {
  it("tool_call web_search → поиск через переданный WebSearcher, результат уходит модели", async () => {
    const { llm, webSearch, params } = setup();
    llm.complete
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("кто такой X")] })
      .mockResolvedValueOnce({ content: "готово", model: "m" });

    await expect(runCardGenerationToolLoop(params)).resolves.toEqual({ done: true, content: "готово" });
    expect(webSearch.search).toHaveBeenCalledWith("кто такой X");
    const second = llm.complete.mock.calls[1]![0];
    expect(second.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call-кто такой X" });
    expect(second.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual(["web_search"]);
  });

  it("ключ Tavily отозван (401) — дальше без web_search, генерация не падает", async () => {
    const { llm, webSearch, params } = setup();
    webSearch.search.mockRejectedValueOnce(new TavilyHttpError(401, "unauthorized"));
    llm.complete
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("q")] })
      .mockResolvedValueOnce({ content: "без поиска", model: "m" });

    await expect(runCardGenerationToolLoop(params)).resolves.toEqual({ done: true, content: "без поиска" });
    const second = llm.complete.mock.calls[1]![0];
    expect(second.messages.at(-1).content).toContain("invalid tavily api key");
    expect(second.tools).toBeUndefined();
  });

  it("без WebSearcher инструмент не предлагается; самовольный tool_call получает ошибку, не поиск", async () => {
    const { llm, params } = setup({ webSearch: null, askUserEnabled: true });
    llm.complete
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("q")] })
      .mockResolvedValueOnce({ content: "ok", model: "m" });

    await runCardGenerationToolLoop(params);
    const first = llm.complete.mock.calls[0]![0];
    expect(first.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual(["ask_user"]);
    expect(llm.complete.mock.calls[1]![0].messages.at(-1).content).toContain("tool unavailable: web_search");
  });
});
