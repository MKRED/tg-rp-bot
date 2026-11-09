import { describe, expect, it } from "vitest";
import { generateBlocker, insertImageTag, maxImageTag } from "./promptTags";

describe("maxImageTag", () => {
  it("наибольший номер", () => {
    expect(maxImageTag("<image2> пьёт из <image1>")).toBe(2);
    expect(maxImageTag("нет")).toBe(0);
  });
});

describe("insertImageTag", () => {
  it("в пустое поле — без пробелов", () => {
    expect(insertImageTag("", 0, 0, 1)).toEqual({ text: "<image1>", cursor: 8 });
  });

  it("между словами — разделяет пробелами", () => {
    expect(insertImageTag("кот|рыжий".replace("|", ""), 3, 3, 2)).toEqual({ text: "кот <image2> рыжий", cursor: 13 });
  });

  it("после пробела и перед запятой — лишних пробелов нет; выделение заменяется", () => {
    expect(insertImageTag("на , да", 3, 3, 1).text).toBe("на <image1>, да");
    expect(insertImageTag("возьми ЭТО", 7, 10, 3).text).toBe("возьми <image3>");
  });
});

describe("generateBlocker", () => {
  it("нет картинок, пустой промпт, тег без картинки", () => {
    expect(generateBlocker("сделай", 0)).toMatch(/Прикрепите/);
    expect(generateBlocker("  ", 1)).toMatch(/Напишите/);
    expect(generateBlocker("<image2> улыбается", 1)).toBe("В промпте есть <image2>, а картинок 1");
    expect(generateBlocker("<image1> улыбается", 1)).toBeNull();
  });
});
