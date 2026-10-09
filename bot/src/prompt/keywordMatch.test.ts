import { describe, expect, it } from "vitest";
import { matchesTriggerKeywords } from "./keywordMatch.js";

describe("matchesTriggerKeywords", () => {
  it("returns false for empty keywords list", () => {
    expect(matchesTriggerKeywords("он взял меч", [])).toBe(false);
  });

  it("returns false for empty/whitespace window text", () => {
    expect(matchesTriggerKeywords("", ["меч"])).toBe(false);
    expect(matchesTriggerKeywords("   ", ["меч"])).toBe(false);
  });

  it("returns false for empty/whitespace-only keyword", () => {
    expect(matchesTriggerKeywords("любой произвольный текст", ["", "   "])).toBe(false);
  });

  it("matches a standalone Cyrillic word but not inside a declined form", () => {
    expect(matchesTriggerKeywords("он взял меч со стены", ["меч"])).toBe(true);
    expect(matchesTriggerKeywords("он рубил мечом", ["меч"])).toBe(false);
    expect(matchesTriggerKeywords("мечи блестели", ["меч"])).toBe(false);
    expect(matchesTriggerKeywords("он стал замечать странности", ["меч"])).toBe(false);
  });

  it("matches at punctuation boundaries", () => {
    expect(matchesTriggerKeywords("меч!", ["меч"])).toBe(true);
    expect(matchesTriggerKeywords("!меч", ["меч"])).toBe(true);
    expect(matchesTriggerKeywords("меч.", ["меч"])).toBe(true);
    expect(matchesTriggerKeywords("(меч)", ["меч"])).toBe(true);
  });

  it("does not match when adjacent to a digit or underscore", () => {
    expect(matchesTriggerKeywords("маг2 пришёл", ["маг"])).toBe(false);
    expect(matchesTriggerKeywords("маг_реджистри", ["маг"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchesTriggerKeywords("Меч был острым", ["меч"])).toBe(true);
    expect(matchesTriggerKeywords("меч был острым", ["Меч"])).toBe(true);
  });

  it("matches multi-word phrases as keywords", () => {
    expect(matchesTriggerKeywords("он взял боевой меч со стены", ["боевой меч"])).toBe(true);
    expect(matchesTriggerKeywords("он взял меч со стены", ["боевой меч"])).toBe(false);
  });

  it("normalizes ё/е on both sides", () => {
    expect(matchesTriggerKeywords("он ел мёд", ["мед"])).toBe(true);
    expect(matchesTriggerKeywords("он ел мед", ["мёд"])).toBe(true);
  });

  it("escapes regex special characters in keywords", () => {
    expect(matchesTriggerKeywords("это c++ язык", ["c++"])).toBe(true);
    expect(matchesTriggerKeywords("axb", ["a.b"])).toBe(false);
    expect(() => matchesTriggerKeywords("some (text) [here]", ["(text)", "[here]", "a|b", "a?", "a\\b", "a$"])).not.toThrow();
  });

  it("matches English words at word boundaries too", () => {
    expect(matchesTriggerKeywords("he picked up a sword", ["sword"])).toBe(true);
    expect(matchesTriggerKeywords("he is a swordsman", ["sword"])).toBe(false);
  });
});
