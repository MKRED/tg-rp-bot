import { describe, expect, it } from "vitest";
import { assembleExportPrompt } from "./assembleExportPrompt";
import type { CardCategory } from "../types/card";

const category = (overrides: Partial<CardCategory>): CardCategory => ({
  id: "base",
  title: "Base",
  description: "",
  content: "",
  enabled: true,
  ...overrides,
});

describe("assembleExportPrompt", () => {
  it("собирает заголовок и текст enabled-категорий через пустую строку", () => {
    const result = assembleExportPrompt([
      category({ id: "base", title: "Base", content: "Высокая, тёмные волосы" }),
      category({ id: "personality", title: "Personality", content: "Спокойная, ироничная" }),
    ]);
    expect(result).toBe("# Base\nВысокая, тёмные волосы\n\n# Personality\nСпокойная, ироничная");
  });

  it("пропускает выключенные категории", () => {
    const result = assembleExportPrompt([
      category({ content: "Текст" }),
      category({ id: "outfit", enabled: false, content: "Не должно попасть" }),
    ]);
    expect(result).toBe("# Base\nТекст");
  });

  it("пропускает категории без сгенерированного текста", () => {
    const result = assembleExportPrompt([category({ content: "" })]);
    expect(result).toBe("");
  });

  it("с includeHeaders=false собирает только текст блоков без заголовков", () => {
    const result = assembleExportPrompt(
      [
        category({ id: "base", title: "Base", content: "Высокая, тёмные волосы" }),
        category({ id: "personality", title: "Personality", content: "Спокойная, ироничная" }),
      ],
      false,
    );
    expect(result).toBe("Высокая, тёмные волосы\n\nСпокойная, ироничная");
  });
});
