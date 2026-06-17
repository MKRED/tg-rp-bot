import { describe, expect, it } from "vitest";
import { parseImageField } from "./imageValidation.js";

describe("parseImageField", () => {
  const MAX = 100;

  it("отсутствие/null → нет картинки", () => {
    expect(parseImageField(undefined, MAX, "Image")).toEqual({ value: null });
    expect(parseImageField(null, MAX, "Image")).toEqual({ value: null });
  });

  it("корректный data:image/*-URL → значение", () => {
    const url = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    expect(parseImageField(url, MAX, "Image")).toEqual({ value: url });
  });

  it("не-строка → ошибка с подписью поля", () => {
    expect(parseImageField(42, MAX, "Full image")).toEqual({
      error: "Full image must be a data:image/* URL",
    });
  });

  it("строка не с data:image/ → ошибка", () => {
    expect(parseImageField("https://example.com/a.png", MAX, "Image")).toEqual({
      error: "Image must be a data:image/* URL",
    });
  });

  it("превышение лимита → ошибка", () => {
    const big = "data:image/png;base64," + "A".repeat(MAX);
    expect(parseImageField(big, MAX, "Image")).toEqual({ error: "Image too large" });
  });
});
