import { describe, expect, it } from "vitest";
import { renderWindowStart } from "./renderWindowStart";

describe("renderWindowStart", () => {
  it("без фиксации показывает последние step сообщений", () => {
    expect(renderWindowStart(null, 100, 40)).toBe(60);
  });

  it("короткая лента рендерится целиком", () => {
    expect(renderWindowStart(null, 10, 40)).toBe(0);
    expect(renderWindowStart(5, 10, 40)).toBe(0);
  });

  it("зафиксированное начало не сдвигается при росте ленты", () => {
    expect(renderWindowStart(60, 105, 40)).toBe(60);
  });

  it("после укорачивания ленты оставляет минимум step сообщений", () => {
    expect(renderWindowStart(60, 80, 40)).toBe(40);
  });

  it("расширенное вверх окно сохраняется", () => {
    expect(renderWindowStart(20, 100, 40)).toBe(20);
  });
});
