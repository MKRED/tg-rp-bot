import { describe, expect, it } from "vitest";
import { buildTagSuggestions } from "./tagSuggestions";

const items = [
  { tags: ["fantasy", "romance"] },
  { tags: ["fantasy", "sci-fi"] },
  { tags: ["fantasy"] },
  { tags: ["romance"] },
];

describe("buildTagSuggestions", () => {
  it("считает частоты и сортирует по убыванию, затем по алфавиту", () => {
    expect(buildTagSuggestions(items, [], "")).toEqual([
      { tag: "fantasy", count: 3 },
      { tag: "romance", count: 2 },
      { tag: "sci-fi", count: 1 },
    ]);
  });

  it("исключает уже выбранные теги", () => {
    expect(buildTagSuggestions(items, ["fantasy"], "")).toEqual([
      { tag: "romance", count: 2 },
      { tag: "sci-fi", count: 1 },
    ]);
  });

  it("фильтрует по подстроке без учёта регистра", () => {
    expect(buildTagSuggestions(items, [], "FAN")).toEqual([{ tag: "fantasy", count: 3 }]);
  });

  it("при пустом draft возвращает все популярные", () => {
    expect(buildTagSuggestions(items, [], "  ")).toHaveLength(3);
  });

  it("ограничивает выдачу limit'ом, отдавая самые частые", () => {
    expect(buildTagSuggestions(items, [], "", 2)).toEqual([
      { tag: "fantasy", count: 3 },
      { tag: "romance", count: 2 },
    ]);
  });

  it("на пустом списке персонажей возвращает []", () => {
    expect(buildTagSuggestions([], [], "")).toEqual([]);
  });
});
