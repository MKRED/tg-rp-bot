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

  const forcedChoice = { type: "function", function: { name: "ask_user" } };

  it("forceAskUser: первый ход — именованный tool_choice ask_user, пауза с вопросами", async () => {
    const { llm, params } = setup({ askUserEnabled: true, forceAskUser: "first" });
    llm.complete.mockResolvedValueOnce({ content: "", model: "m", toolCalls: [askCall()] });

    await expect(runCardGenerationToolLoop(params)).resolves.toMatchObject({ done: false });
    expect(llm.complete.mock.calls[0]![0].toolChoice).toEqual(forcedChoice);
  });

  it("forceAskUser действует только на первый ход: битые аргументы → дальше auto и обычный текст", async () => {
    const { llm, params } = setup({
      askUserEnabled: true,
      forceAskUser: "first",
      baseOptions: { userId: 1, requestReasoning: true },
    });
    const broken = { id: "bad", type: "function" as const, function: { name: "ask_user", arguments: "{" } };
    llm.complete
      .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [broken] })
      .mockResolvedValueOnce({ content: "текст", model: "m" });

    await expect(runCardGenerationToolLoop(params)).resolves.toEqual({ done: true, content: "текст" });
    expect(llm.complete.mock.calls[0]![0].toolChoice).toEqual(forcedChoice);
    expect(llm.complete.mock.calls[1]![0].toolChoice).toBe("auto");
    // DeepSeek не принимает принуждение в thinking-режиме: reasoning выключен только на этом ходе.
    expect(llm.complete.mock.calls[0]![0].requestReasoning).toBe(false);
    expect(llm.complete.mock.calls[1]![0].requestReasoning).toBe(true);
  });

  it("без forceAskUser и при выключенном ask_user принуждения нет — auto", async () => {
    const plain = setup({ askUserEnabled: true });
    plain.llm.complete.mockResolvedValueOnce({ content: "t", model: "m" });
    await runCardGenerationToolLoop(plain.params);
    expect(plain.llm.complete.mock.calls[0]![0].toolChoice).toBe("auto");

    const gated = setup({ askUserEnabled: false, forceAskUser: "first" });
    gated.llm.complete.mockResolvedValueOnce({ content: "t", model: "m" });
    await runCardGenerationToolLoop(gated.params);
    expect(gated.llm.complete.mock.calls[0]![0].toolChoice).toBe("auto");
  });

  describe("forceAskUser: last — вопросы после остальных инструментов", () => {
    const last = (over: Partial<Params> = {}) =>
      setup({ askUserEnabled: true, forceAskUser: "last", baseOptions: { userId: 1, requestReasoning: true }, ...over });

    it("поиск → черновик отброшен → принудительный ход видит результаты поиска, пауза", async () => {
      const { llm, params } = last();
      llm.complete
        .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [searchCall("q")] })
        .mockResolvedValueOnce({ content: "черновик", model: "m" })
        .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [askCall()] });

      await expect(runCardGenerationToolLoop(params)).resolves.toMatchObject({ done: false });
      const [first, second, third] = llm.complete.mock.calls.map((c) => c[0]);
      expect(first.toolChoice).toBe("auto");
      expect(second.toolChoice).toBe("auto");
      expect(third.toolChoice).toEqual(forcedChoice);
      expect(third.requestReasoning).toBe(false);
      // Черновик в историю не попал; результат поиска — на месте.
      expect(JSON.stringify(third.messages)).not.toContain("черновик");
      expect(third.messages).toContainEqual(expect.objectContaining({ role: "tool", tool_call_id: "call-q" }));
    });

    it("модель сама позвала ask_user — принуждения нет, один вызов LLM", async () => {
      const { llm, params } = last();
      llm.complete.mockResolvedValueOnce({ content: "", model: "m", toolCalls: [askCall()] });

      await expect(runCardGenerationToolLoop(params)).resolves.toMatchObject({ done: false });
      expect(llm.complete).toHaveBeenCalledTimes(1);
      expect(llm.complete.mock.calls[0]![0].toolChoice).toBe("auto");
    });

    it("принудительный ход с битыми аргументами — больше не принуждаем, текст принимается", async () => {
      const { llm, params } = last();
      const broken = { id: "bad", type: "function" as const, function: { name: "ask_user", arguments: "{" } };
      llm.complete
        .mockResolvedValueOnce({ content: "черновик", model: "m" })
        .mockResolvedValueOnce({ content: "", model: "m", toolCalls: [broken] })
        .mockResolvedValueOnce({ content: "текст", model: "m" });

      await expect(runCardGenerationToolLoop(params)).resolves.toEqual({ done: true, content: "текст" });
      expect(llm.complete).toHaveBeenCalledTimes(3);
      expect(llm.complete.mock.calls[2]![0].toolChoice).toBe("auto");
    });

    it("других инструментов нет — принуждаем сразу, без черновика на выброс", async () => {
      const { llm, params } = last({ webSearch: null });
      llm.complete.mockResolvedValueOnce({ content: "", model: "m", toolCalls: [askCall()] });

      await runCardGenerationToolLoop(params);
      expect(llm.complete).toHaveBeenCalledTimes(1);
      expect(llm.complete.mock.calls[0]![0].toolChoice).toEqual(forcedChoice);
    });

    it("ask_user недоступен — текст возвращается как есть", async () => {
      const { llm, params } = last({ askUserEnabled: false });
      llm.complete.mockResolvedValueOnce({ content: "текст", model: "m" });

      await expect(runCardGenerationToolLoop(params)).resolves.toEqual({ done: true, content: "текст" });
      expect(llm.complete).toHaveBeenCalledTimes(1);
    });
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
