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

  it("web_search при исчерпанном лимите не выполняется, цикл конечен (предложен только ask_user)", async () => {
    const onWebSearch = vi.fn();
    const { llm, webSearch, params } = setup({ maxSearchRounds: 0, askUserEnabled: true, onWebSearch });
    llm.complete
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("q1")] })
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("q2")] })
      .mockResolvedValueOnce({ content: "текст", model: "m" });

    await expect(runCardGenerationToolLoop(params)).resolves.toEqual({ done: true, content: "текст" });
    expect(webSearch.search).not.toHaveBeenCalled();
    expect(onWebSearch).not.toHaveBeenCalled();
    // Два непредложенных вызова исчерпали и бюджет ask_user — третий запрос уходит без инструментов.
    expect(llm.complete.mock.calls[2]![0].tools).toBeUndefined();
  });

  it("успешный поиск отдаётся в onWebSearch, неудачный — нет", async () => {
    const onWebSearch = vi.fn();
    const { llm, webSearch, params } = setup({ onWebSearch });
    webSearch.search
      .mockResolvedValueOnce([{ title: "T", url: "u", content: "c" }])
      .mockRejectedValueOnce(new Error("network"));
    llm.complete
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("ok"), searchCall("fail")] })
      .mockResolvedValueOnce({ content: "готово", model: "m" });

    await runCardGenerationToolLoop(params);
    expect(onWebSearch).toHaveBeenCalledTimes(1);
    expect(onWebSearch).toHaveBeenCalledWith({ query: "ok", results: [{ title: "T", url: "u", content: "c" }] });
  });
});

describe("runCardGenerationToolLoop — ask_user", () => {
  const askCall = (id = "ask-1") => ({
    id,
    type: "function" as const,
    function: { name: "ask_user", arguments: JSON.stringify({ questions: [{ question: "Пол?" }] }) },
  });

  it("поиск в одном ходе с ask_user выполняется и сохраняется, цикл уходит на паузу", async () => {
    const onWebSearch = vi.fn();
    const { llm, webSearch, params } = setup({ askUserEnabled: true, onWebSearch });
    llm.complete.mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("q"), askCall()] });

    await expect(runCardGenerationToolLoop(params)).resolves.toEqual({
      done: false,
      questions: [{ question: "Пол?", options: undefined }],
    });
    expect(webSearch.search).toHaveBeenCalledWith("q");
    expect(onWebSearch).toHaveBeenCalledWith(expect.objectContaining({ query: "q" }));
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it("ask_user без предложения (выключен) — ошибка модели вместо паузы, цикл конечен", async () => {
    const { llm, params } = setup({ askUserEnabled: false, maxSearchRounds: 2 });
    // Модель упорно зовёт непредложенный ask_user: каждый вызов списывает бюджет поиска, и после
    // его исчерпания запрос уходит без tools — ответ принимается как текст.
    llm.complete
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [askCall("a1")] })
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [askCall("a2")] })
      .mockResolvedValueOnce({ content: "текст", model: "m" });

    await expect(runCardGenerationToolLoop(params)).resolves.toEqual({ done: true, content: "текст" });
    const second = llm.complete.mock.calls[1]![0];
    expect(second.messages.at(-1).content).toContain("tool unavailable: ask_user");
    expect(llm.complete.mock.calls[2]![0].tools).toBeUndefined();
  });
});
