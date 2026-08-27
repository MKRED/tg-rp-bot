import { describe, expect, it } from "vitest";
import { parseCardInput } from "./cards.validation.js";

describe("parseCardInput", () => {
  it("отклоняет тело, которое не объект", () => {
    expect(parseCardInput(null)).toEqual({ error: "Body must be an object" });
    expect(parseCardInput("строка")).toEqual({ error: "Body must be an object" });
  });

  it("отклоняет тело без имени", () => {
    expect(parseCardInput({ categories: [] })).toEqual({ error: "Name is required" });
  });

  it("отклоняет пустое/пробельное имя", () => {
    expect(parseCardInput({ name: "   ", categories: [] })).toEqual({ error: "Name is required" });
  });

  it("принимает и обрезает имя по краям, дефолтит пустые systemPrompt/prompt/categories/presetId", () => {
    expect(parseCardInput({ name: "  Артур  ", categories: [] })).toEqual({
      input: {
        name: "Артур",
        systemPrompt: "",
        prompt: "",
        categories: [],
        presetId: null,
        useWebSearch: false,
        useAskUser: false,
      },
    });
  });

  it("отклоняет categories не-массив", () => {
    expect(parseCardInput({ name: "Артур", categories: "нет" })).toEqual({
      error: "categories must be an array",
    });
  });

  it("отклоняет слишком много категорий", () => {
    const categories = Array.from({ length: 31 }, (_, i) => ({
      id: `c${i}`,
      title: "T",
      description: "",
      content: "",
      enabled: true,
    }));
    expect(parseCardInput({ name: "Артур", categories })).toEqual({
      error: "Too many categories (max 30)",
    });
  });

  it("отклоняет категорию без id", () => {
    expect(
      parseCardInput({
        name: "Артур",
        categories: [{ id: "", title: "Base", description: "", content: "", enabled: true }],
      }),
    ).toEqual({ error: "Category 0: id is required" });
  });

  it("отклоняет категорию с нестроковым/небулевым полем", () => {
    expect(
      parseCardInput({
        name: "Артур",
        categories: [{ id: "base", title: "Base", description: "", content: "", enabled: "yes" }],
      }),
    ).toEqual({ error: "Category 0: enabled must be a boolean" });
  });

  it("принимает полный валидный вход с systemPrompt, prompt, категориями и presetId", () => {
    expect(
      parseCardInput({
        name: "Артур",
        systemPrompt: "Custom system instructions",
        prompt: "Custom prompt {{example}}",
        categories: [{ id: "base", title: "Base", description: "Name: ...", content: "", enabled: true }],
        presetId: 5,
      }),
    ).toEqual({
      input: {
        name: "Артур",
        systemPrompt: "Custom system instructions",
        prompt: "Custom prompt {{example}}",
        categories: [{ id: "base", title: "Base", description: "Name: ...", content: "", enabled: true }],
        presetId: 5,
        useWebSearch: false,
        useAskUser: false,
      },
    });
  });

  it("отклоняет нецелый presetId", () => {
    expect(parseCardInput({ name: "Артур", categories: [], presetId: 1.5 })).toEqual({
      error: "presetId must be an integer",
    });
  });

  it("принимает useWebSearch: true", () => {
    const result = parseCardInput({ name: "Артур", categories: [], useWebSearch: true });
    expect("input" in result && result.input.useWebSearch).toBe(true);
  });

  it("принимает useAskUser: true", () => {
    const result = parseCardInput({ name: "Артур", categories: [], useAskUser: true });
    expect("input" in result && result.input.useAskUser).toBe(true);
  });

  it("отклоняет дубликат id категорий", () => {
    expect(
      parseCardInput({
        name: "Артур",
        categories: [
          { id: "base", title: "Base", description: "", content: "", enabled: true },
          { id: "base", title: "Base 2", description: "", content: "", enabled: true },
        ],
      }),
    ).toEqual({ error: "Category 1: duplicate id" });
  });

  it("обрезает пробелы у title/description категории", () => {
    const result = parseCardInput({
      name: "Артур",
      categories: [{ id: "base", title: "  Base  ", description: "  Name: ...  ", content: "  raw  ", enabled: true }],
    });
    expect(result).toEqual({
      input: {
        name: "Артур",
        systemPrompt: "",
        prompt: "",
        categories: [{ id: "base", title: "Base", description: "Name: ...", content: "  raw  ", enabled: true }],
        presetId: null,
        useWebSearch: false,
        useAskUser: false,
      },
    });
  });
});
