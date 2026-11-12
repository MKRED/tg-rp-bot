import { describe, expect, it } from "vitest";
import { filterCardOptions, selectedCardOptions, toggleCardId } from "./cardsPicker";

const options = [
  { id: 1, name: "Niva Irbis", updatedAt: "2026-11-10T10:00:00Z" },
  { id: 2, name: "Nyra Irbis", updatedAt: "2026-11-09T10:00:00Z" },
  { id: 3, name: "Kirino Kousaka", updatedAt: "2026-11-01T10:00:00Z" },
];

describe("cardsPicker", () => {
  it("поиск по имени без учёта регистра; пустой запрос — весь список", () => {
    expect(filterCardOptions(options, "irbis").map((o) => o.id)).toEqual([1, 2]);
    expect(filterCardOptions(options, "  ")).toBe(options);
    expect(filterCardOptions(options, "zzz")).toEqual([]);
  });

  it("отметка: в конец по порядку выбора, снятие, на лимите — без изменений", () => {
    expect(toggleCardId([3], 1, 4)).toEqual([3, 1]);
    expect(toggleCardId([3, 1], 3, 4)).toEqual([1]);
    expect(toggleCardId([1, 2], 3, 2)).toEqual([1, 2]);
    expect(toggleCardId([1, 2], 2, 2)).toEqual([1]);
  });

  it("выбранные — в порядке выбора, удалённые пропускаются", () => {
    expect(selectedCardOptions(options, [3, 99, 1]).map((o) => o.id)).toEqual([3, 1]);
  });
});
