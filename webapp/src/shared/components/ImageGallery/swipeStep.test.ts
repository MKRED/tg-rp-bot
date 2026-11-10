import { describe, expect, it } from "vitest";
import { swipeStep } from "./swipeStep";

describe("swipeStep", () => {
  it("далёкий сдвиг листает в сторону, противоположную пальцу", () => {
    expect(swipeStep(-120, 0, 400, true, true)).toBe(1);
    expect(swipeStep(120, 0, 400, true, true)).toBe(-1);
  });

  it("короткий медленный сдвиг возвращает картинку", () => {
    expect(swipeStep(-60, 100, 400, true, true)).toBe(0);
  });

  it("быстрый бросок листает и на коротком сдвиге, дрожь при тапе — нет", () => {
    expect(swipeStep(-40, -900, 400, true, true)).toBe(1);
    expect(swipeStep(-10, -900, 400, true, true)).toBe(0);
    // Бросок против сдвига (палец передумал) — не листаем.
    expect(swipeStep(-40, 900, 400, true, true)).toBe(0);
  });

  it("на краю соседней нет — возврат", () => {
    expect(swipeStep(-200, 0, 400, true, false)).toBe(0);
    expect(swipeStep(200, 0, 400, false, true)).toBe(0);
  });
});
