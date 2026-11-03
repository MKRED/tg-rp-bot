import { describe, expect, it } from "vitest";
import { wordDiff } from "./wordDiff";

describe("wordDiff", () => {
  it("пустой исходник — весь текст вставка", () => {
    expect(wordDiff("", "new text")).toEqual([{ type: "ins", text: "new text" }]);
  });

  it("одинаковые тексты — без изменений", () => {
    expect(wordDiff("a b", "a b")).toEqual([{ type: "same", text: "a b" }]);
  });

  it("подсвечивает заменённые слова, остальное как есть", () => {
    expect(wordDiff("they write once a month", "they write rarely now")).toEqual([
      { type: "same", text: "they write " },
      { type: "del", text: "once a month" },
      { type: "ins", text: "rarely now" },
    ]);
  });

  it("собранный обратно результат совпадает с новым текстом", () => {
    const before = "- Father: dead\n- Sister: writes monthly";
    const after = "- Father: dead\n- Sister: writes monthly, but shorter\n- Mother: unknown";
    const rebuilt = wordDiff(before, after)
      .filter((s) => s.type !== "del")
      .map((s) => s.text)
      .join("");
    expect(rebuilt).toBe(after);
  });
});
