import { describe, expect, it } from "vitest";
import { describeToolUsage, toolUsageDetails, toolUsageSummary } from "./toolUsage";

const tool = (name: string) => ({ type: "function", function: { name, description: "", parameters: {} } });
const call = (id: string, name: string) => ({ id, type: "function" as const, function: { name, arguments: "{}" } });
const record = (request: Record<string, unknown>, toolCalls?: ReturnType<typeof call>[]) => ({
  request,
  response: { ok: true, toolCalls },
});

describe("describeToolUsage", () => {
  it("модель вызвала ask_user — это не веб-поиск", () => {
    const usage = describeToolUsage(
      record({ messages: [{ role: "user", content: "q" }], tools: [tool("web_search"), tool("ask_user")] }, [
        call("c1", "ask_user"),
      ]),
    );
    expect(usage).toEqual({ offered: ["web_search", "ask_user"], called: ["ask_user"], resultsInHistory: [] });
    expect(toolUsageSummary(usage)).toBe("вызов: вопрос пользователю");
  });

  it("синтетический реплей ask_user в истории не считается поиском и в шапку не попадает", () => {
    const usage = describeToolUsage(
      record({
        messages: [
          { role: "user", content: "q" },
          { role: "assistant", content: null, tool_calls: [call("ask_user_base", "ask_user")] },
          { role: "tool", tool_call_id: "ask_user_base", content: "{}" },
        ],
      }),
    );
    expect(usage).toEqual({ offered: [], called: [], resultsInHistory: ["ask_user"] });
    expect(toolUsageSummary(usage)).toBeUndefined();
    expect(toolUsageDetails(usage)).toBeUndefined();
  });

  it("результат web_search в истории + новый вызов поиска в этом раунде", () => {
    const usage = describeToolUsage(
      record(
        {
          messages: [
            { role: "assistant", content: null, tool_calls: [call("s1", "web_search"), call("s2", "web_search")] },
            { role: "tool", tool_call_id: "s1", content: "[]" },
            { role: "tool", tool_call_id: "s2", content: "[]" },
          ],
          tools: [tool("web_search")],
        },
        [call("s3", "web_search")],
      ),
    );
    expect(usage).toEqual({ offered: ["web_search"], called: ["web_search"], resultsInHistory: ["web_search"] });
    expect(toolUsageSummary(usage)).toBe("вызов: веб-поиск · с результатами поиска");
    expect(toolUsageDetails(usage)).toBe("Инструменты: предложены — web_search; вызваны — web_search");
  });

  it("инструмент предложен, но не вызван — в шапке пусто, в деталях видно", () => {
    const usage = describeToolUsage(record({ messages: [], tools: [tool("web_search")] }));
    expect(toolUsageSummary(usage)).toBeUndefined();
    expect(toolUsageDetails(usage)).toBe("Инструменты: предложены — web_search; вызваны — нет");
  });

  it("запрос без инструментов и без messages — пустой результат", () => {
    expect(describeToolUsage(record({}))).toEqual({ offered: [], called: [], resultsInHistory: [] });
  });

  it("неизвестное имя инструмента показывается как есть", () => {
    expect(toolUsageSummary({ offered: [], called: ["lookup"], resultsInHistory: [] })).toBe("вызов: lookup");
  });
});
