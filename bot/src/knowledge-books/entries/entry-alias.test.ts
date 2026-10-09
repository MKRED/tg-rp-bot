import { describe, expect, it } from "vitest";
import { characterNeedsUserAlias, personaNeedsCharAlias } from "./entry-alias.js";

describe("characterNeedsUserAlias", () => {
  it("true, если {{user}} в prompt", () => {
    expect(characterNeedsUserAlias({ prompt: "Привет, {{user}}!", scenario: "" })).toBe(true);
  });

  it("true, если {{user}} в scenario", () => {
    expect(characterNeedsUserAlias({ prompt: "", scenario: "Сцена для {{USER}}" })).toBe(true);
  });

  it("false, если плейсхолдера нет ни в одном из полей", () => {
    expect(characterNeedsUserAlias({ prompt: "Обычный текст", scenario: "Ещё текст" })).toBe(false);
  });
});

describe("personaNeedsCharAlias", () => {
  it("true, если {{char}} в prompt (регистронезависимо)", () => {
    expect(personaNeedsCharAlias({ prompt: "Обращаюсь к {{CHAR}}" })).toBe(true);
  });

  it("false, если плейсхолдера нет", () => {
    expect(personaNeedsCharAlias({ prompt: "Обычный текст без плейсхолдеров" })).toBe(false);
  });
});
