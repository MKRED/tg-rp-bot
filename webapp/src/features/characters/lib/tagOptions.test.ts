import { describe, expect, it } from "vitest";
import { buildTagOptions } from "./tagOptions";

const items = [
  { tags: ["fantasy", "romance"] },
  { tags: ["fantasy", "sci-fi"] },
  { tags: ["fantasy"] },
  { tags: ["romance"] },
];

describe("buildTagOptions", () => {
  it("считает частоты и сортирует по убыванию, затем по алфавиту", () => {
    expect(buildTagOptions(items)).toEqual([
      { value: "fantasy", label: "fantasy", count: 3 },
      { value: "romance", label: "romance", count: 2 },
      { value: "sci-fi", label: "sci-fi", count: 1 },
    ]);
  });

  it("на пустом списке персонажей возвращает []", () => {
    expect(buildTagOptions([])).toEqual([]);
  });
});
