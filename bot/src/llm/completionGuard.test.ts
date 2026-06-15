import { describe, expect, it } from "vitest";
import { isUnusableCompletion } from "./completionGuard.js";

describe("isUnusableCompletion", () => {
  it("считает пустой текст непригодным", () => {
    expect(isUnusableCompletion("")).toBe(true);
    expect(isUnusableCompletion("   ")).toBe(true);
    expect(isUnusableCompletion("\n\t ")).toBe(true);
  });

  it("считает известную фразу-отказа непригодной (в т.ч. с пробелами по краям)", () => {
    expect(isUnusableCompletion("你好，我无法给到相关内容。")).toBe(true);
    expect(isUnusableCompletion("  你好，我无法给到相关内容。\n")).toBe(true);
  });

  it("пропускает нормальный ответ", () => {
    expect(isUnusableCompletion("Привет!")).toBe(false);
    expect(isUnusableCompletion("Окей, продолжаем сцену...")).toBe(false);
  });

  it("не зарубает ответ, лишь цитирующий фразу-отказа (точное сравнение, не includes)", () => {
    expect(
      isUnusableCompletion('Персонаж усмехнулся: "你好，我无法给到相关内容。" — и подмигнул.'),
    ).toBe(false);
  });
});
