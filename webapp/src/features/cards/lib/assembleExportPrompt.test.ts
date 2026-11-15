import { describe, expect, it } from "vitest";
import { assembleExportPrompt, blockTagName } from "./assembleExportPrompt";
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

  it("plain — только текст блоков без заголовков ", () => {
    const result = assembleExportPrompt(
      [
        category({ id: "base", title: "Base", content: "Высокая, тёмные волосы" }),
        category({ id: "personality", title: "Personality", content: "Спокойная, ироничная" }),
      ],
      "plain",
    );
    expect(result).toBe("Высокая, тёмные волосы\n\nСпокойная, ироничная");
  });

  it("tags — каждый блок в тегах по названию блока", () => {
    const result = assembleExportPrompt(
      [
        category({ id: "base", title: "Base", content: "Высокая" }),
        category({ id: "speechStyle", title: "Speech Style", content: " Тихо " }),
      ],
      "tags",
    );
    expect(result).toBe("<base>\nВысокая\n</base>\n\n<speech_style>\nТихо\n</speech_style>");
  });
});

describe("blockTagName", () => {
  it("snake_case из букв и цифр, кириллица остаётся", () => {
    expect(blockTagName({ id: "x", title: "Hobbies / Likes" })).toBe("hobbies_likes");
    expect(blockTagName({ id: "x", title: "Внешность героя" })).toBe("внешность_героя");
    expect(blockTagName({ id: "x", title: "Act 2: Plan" })).toBe("act_2_plan");
  });

  it("название без букв и цифр — тег по id блока", () => {
    expect(blockTagName({ id: "custom1", title: " / " })).toBe("custom1");
  });
});
