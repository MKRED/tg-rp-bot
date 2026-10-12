import { describe, expect, it } from "vitest";
import { defaultGreeting, resolveGreetingIndex } from "./greetingChoice";

describe("defaultGreeting", () => {
  it("первое приветствие, если они есть", () => {
    expect(defaultGreeting(3)).toBe(0);
  });

  it("null, если приветствий нет", () => {
    expect(defaultGreeting(0)).toBeNull();
  });
});

describe("resolveGreetingIndex", () => {
  it("конкретный индекс — как есть", () => {
    expect(resolveGreetingIndex(2, 3)).toBe(2);
  });

  it("random — индекс в пределах списка", () => {
    expect(resolveGreetingIndex("random", 3, () => 0)).toBe(0);
    expect(resolveGreetingIndex("random", 3, () => 0.99)).toBe(2);
  });

  it("random без приветствий и null — 0", () => {
    expect(resolveGreetingIndex("random", 0, () => 0.5)).toBe(0);
    expect(resolveGreetingIndex(null, 0)).toBe(0);
  });
});
