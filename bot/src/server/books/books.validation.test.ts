import { describe, expect, it } from "vitest";
import {
  characterNeedsUserAlias,
  parseEntryInput,
  personaNeedsCharAlias,
} from "./books.validation.js";

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

describe("parseEntryInput", () => {
  const base = { name: "Запись" };

  it("отклоняет тело без имени", () => {
    const result = parseEntryInput({ content: "Текст" });
    expect(result).toEqual({ error: "Name is required" });
  });

  it("отклоняет одновременный characterId и personaId", () => {
    const result = parseEntryInput({ ...base, characterId: 1, personaId: 2 });
    expect(result).toEqual({ error: "Entry cannot reference both a character and a persona" });
  });

  it("отклоняет запись без characterId/personaId и без содержательного content", () => {
    const result = parseEntryInput({ ...base, content: "   " });
    expect(result).toEqual({ error: "Entry needs a character, a persona or content" });
  });

  it("принимает запись-персонажа с alias", () => {
    const result = parseEntryInput({ ...base, characterId: 1, alias: "Странник" });
    expect(result).toEqual({
      input: {
        name: "Запись",
        enabled: true,
        activation: "always_on",
        characterId: 1,
        personaId: null,
        alias: "Странник",
        content: "",
        keywords: [],
      },
    });
  });

  it("принимает запись-персону с alias", () => {
    const result = parseEntryInput({ ...base, personaId: 5, alias: "Артур" });
    expect(result).toEqual({
      input: {
        name: "Запись",
        enabled: true,
        activation: "always_on",
        characterId: null,
        personaId: 5,
        alias: "Артур",
        content: "",
        keywords: [],
      },
    });
  });

  it("принимает свободный текст без ссылок", () => {
    const result = parseEntryInput({ ...base, content: "Факт о мире" });
    expect(result).toEqual({
      input: {
        name: "Запись",
        enabled: true,
        activation: "always_on",
        characterId: null,
        personaId: null,
        alias: "",
        content: "Факт о мире",
        keywords: [],
      },
    });
  });
});
