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
        keywordDepth: 10,
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
        keywordDepth: 10,
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
        keywordDepth: 10,
      },
    });
  });

  it("отклоняет keyword-активацию без единого триггер-слова", () => {
    const result = parseEntryInput({ ...base, content: "Факт", activation: "keyword", keywords: [] });
    expect(result).toEqual({ error: "Keyword activation requires at least one keyword" });
  });

  it("отклоняет keyword-активацию, если все триггер-слова пустые/пробельные", () => {
    const result = parseEntryInput({
      ...base,
      content: "Факт",
      activation: "keyword",
      keywords: ["  ", ""],
    });
    expect(result).toEqual({ error: "Keyword activation requires at least one keyword" });
  });

  it("принимает keyword-активацию с триггер-словами и глубиной поиска", () => {
    const result = parseEntryInput({
      ...base,
      content: "Факт",
      activation: "keyword",
      keywords: [" меч ", "клинок"],
      keywordDepth: 25,
    });
    expect(result).toEqual({
      input: {
        name: "Запись",
        enabled: true,
        activation: "keyword",
        characterId: null,
        personaId: null,
        alias: "",
        content: "Факт",
        keywords: ["меч", "клинок"],
        keywordDepth: 25,
      },
    });
  });

  it("клампит keywordDepth ниже минимума до MIN_KEYWORD_DEPTH", () => {
    const result = parseEntryInput({ ...base, content: "Факт", keywordDepth: -5 });
    expect(result).toEqual({ input: expect.objectContaining({ keywordDepth: 1 }) });
  });

  it("клампит keywordDepth выше максимума до MAX_KEYWORD_DEPTH", () => {
    const result = parseEntryInput({ ...base, content: "Факт", keywordDepth: 10_000 });
    expect(result).toEqual({ input: expect.objectContaining({ keywordDepth: 200 }) });
  });

  it("нецелая/нечисловая keywordDepth усекается или падает на дефолт", () => {
    const fractional = parseEntryInput({ ...base, content: "Факт", keywordDepth: 12.9 });
    expect(fractional).toEqual({ input: expect.objectContaining({ keywordDepth: 12 }) });

    const nonNumeric = parseEntryInput({ ...base, content: "Факт", keywordDepth: "42" });
    expect(nonNumeric).toEqual({ input: expect.objectContaining({ keywordDepth: 10 }) });

    const missing = parseEntryInput({ ...base, content: "Факт" });
    expect(missing).toEqual({ input: expect.objectContaining({ keywordDepth: 10 }) });
  });

  it("обрезает триггер-слова длиннее 100 символов", () => {
    const long = "а".repeat(150);
    const result = parseEntryInput({
      ...base,
      content: "Факт",
      activation: "keyword",
      keywords: [long],
    });
    expect(result).toEqual({
      input: expect.objectContaining({ keywords: [long.slice(0, 100)] }),
    });
  });
});
