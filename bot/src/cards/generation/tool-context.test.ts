import type { CardCategory } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import { countTokens } from "../../utils/tokens.js";
import { buildToolContextMessages, countToolContextTokens, withToolContextTokens } from "./tool-context.js";

const category = (over: Partial<CardCategory> = {}): CardCategory => ({
  id: "base",
  title: "Base",
  description: "d",
  content: "",
  enabled: true,
  ...over,
});

const search = (query: string) => ({ query, results: [{ title: "T", url: "https://u", content: `про ${query}` }] });

// tool_calls/tool_call_id есть не у всех членов union — в проверках читаем через any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const build = (c: CardCategory) => buildToolContextMessages(c) as any[];

describe("buildToolContextMessages", () => {
  it("без контекста — пусто", () => {
    expect(buildToolContextMessages(category())).toEqual([]);
    expect(buildToolContextMessages(category({ webSearches: [], askUserAnswers: [] }))).toEqual([]);
  });

  it("веб-поиски: один assistant-ход со всеми вызовами и по tool-результату на каждый", () => {
    const messages = build(category({ webSearches: [search("эльфы"), search("гномы")] }));
    expect(messages.map((m) => m.role)).toEqual(["assistant", "tool", "tool"]);
    expect(messages[0].reasoning_content).toBeTruthy();
    expect(messages[0].tool_calls.map((c: { function: { name: string } }) => c.function.name)).toEqual([
      "web_search",
      "web_search",
    ]);
    expect(JSON.parse(messages[0].tool_calls[1].function.arguments)).toEqual({ query: "гномы" });
    expect(messages[2].tool_call_id).toBe(messages[0].tool_calls[1].id);
    expect(JSON.parse(messages[2].content)).toEqual(search("гномы").results);
  });

  it("поиски идут перед вопросами, id вызовов не пересекаются", () => {
    const messages = build(
      category({ webSearches: [search("q")], askUserAnswers: [{ question: "Пол?", answer: "Женский" }] }),
    );
    expect(messages.map((m) => m.role)).toEqual(["assistant", "tool", "assistant", "tool"]);
    expect(messages[2].tool_calls[0].function.name).toBe("ask_user");
    expect(messages[3].tool_call_id).toBe(messages[2].tool_calls[0].id);
    expect(messages[0].tool_calls[0].id).not.toBe(messages[2].tool_calls[0].id);
  });

  it("дополнение пользователя — отдельным полем результата, в аргументах вызова его нет", () => {
    const answered = { question: "Пол?", answer: "Женский" };
    const messages = build(
      category({ askUserAnswers: [answered, { question: "", answer: "Она левша", unprompted: true }] }),
    );
    expect(JSON.parse(messages[0].tool_calls[0].function.arguments)).toEqual({ questions: [{ question: "Пол?" }] });
    const result = JSON.parse(messages[1].content);
    expect(result.answers).toEqual([answered]);
    expect(result.additional_user_instructions).toEqual(["Она левша"]);
  });

  it("без дополнений результат ask_user не содержит поля дополнений", () => {
    const messages = build(category({ askUserAnswers: [{ question: "Пол?", answer: "Женский" }] }));
    expect(Object.keys(JSON.parse(messages[1].content))).toEqual(["answers", "note"]);
  });

  it("детерминирован: одинаковая категория даёт одинаковые сообщения (кэш префикса)", () => {
    const c = category({ webSearches: [search("q")] });
    expect(buildToolContextMessages(c)).toEqual(buildToolContextMessages(c));
  });
});

describe("countToolContextTokens", () => {
  it("без контекста — 0", () => {
    expect(countToolContextTokens(category())).toBe(0);
  });

  it("считает то, что реально уходит в промпт, и растёт с каждым поиском", () => {
    const one = countToolContextTokens(category({ webSearches: [search("эльфы")] }));
    const two = countToolContextTokens(category({ webSearches: [search("эльфы"), search("гномы")] }));
    expect(one).toBeGreaterThanOrEqual(countTokens(JSON.stringify(search("эльфы").results)));
    expect(two).toBeGreaterThan(one);
  });

  it("withToolContextTokens проставляет счётчик каждой категории, не трогая остальные поля", () => {
    const withContext = category({ id: "a", askUserAnswers: [{ question: "Q", answer: "A" }] });
    const [a, b] = withToolContextTokens([withContext, category({ id: "b" })]);
    expect(a).toEqual({ ...withContext, toolContextTokens: countToolContextTokens(withContext) });
    expect(a!.toolContextTokens).toBeGreaterThan(0);
    expect(b!.toolContextTokens).toBe(0);
  });
});
