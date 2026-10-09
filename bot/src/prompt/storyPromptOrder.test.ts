import { describe, expect, it } from "vitest";
import { normalizeStoryPromptOrder } from "./storyPromptOrder.js";

describe("normalizeStoryPromptOrder", () => {
  it("старый 6-элементный порядок → дописывает `compact` перед `history`, сохраняя остальной порядок", () => {
    const legacy = [
      { id: "system", enabled: true },
      { id: "lorebook", enabled: true },
      { id: "auxiliary", enabled: true },
      { id: "premise", enabled: true },
      { id: "history", enabled: true },
      { id: "postHistory", enabled: false },
    ];
    const result = normalizeStoryPromptOrder(legacy);
    expect(result.map((i) => i.id)).toEqual([
      "system",
      "lorebook",
      "auxiliary",
      "premise",
      "compact",
      "history",
      "postHistory",
    ]);
    // compact дописан включённым (дефолт), остальные флаги сохранены.
    expect(result.find((i) => i.id === "compact")!.enabled).toBe(true);
    expect(result.find((i) => i.id === "postHistory")!.enabled).toBe(false);
  });

  it("сохраняет пользовательский порядок остальных компонентов", () => {
    const custom = [
      { id: "premise", enabled: false },
      { id: "system", enabled: true },
      { id: "history", enabled: true },
      { id: "lorebook", enabled: false },
      { id: "auxiliary", enabled: true },
      { id: "postHistory", enabled: true },
    ];
    const result = normalizeStoryPromptOrder(custom);
    // compact вставляется относительно дефолтного соседа (после premise), порядок прочих не меняется.
    expect(result.map((i) => i.id)).toEqual([
      "premise",
      "compact",
      "system",
      "history",
      "lorebook",
      "auxiliary",
      "postHistory",
    ]);
    expect(result.find((i) => i.id === "premise")!.enabled).toBe(false);
  });

  it("отбрасывает неизвестные id и дубли, добивает недостающее", () => {
    const messy = [
      { id: "system", enabled: true },
      { id: "system", enabled: false }, // дубль → игнор
      { id: "bogus", enabled: true }, // неизвестный → игнор
    ];
    const result = normalizeStoryPromptOrder(messy);
    expect(result.map((i) => i.id).sort()).toEqual(
      ["auxiliary", "compact", "history", "lorebook", "postHistory", "premise", "system"].sort(),
    );
    // первое вхождение system (enabled:true) сохранено.
    expect(result.find((i) => i.id === "system")!.enabled).toBe(true);
    // каждый канонический id ровно один раз.
    expect(result.length).toBe(7);
  });

  it("не массив → возвращает канонический дефолт (7 компонентов)", () => {
    expect(normalizeStoryPromptOrder(null).length).toBe(7);
    expect(normalizeStoryPromptOrder(undefined).map((i) => i.id)).toContain("compact");
  });
});
