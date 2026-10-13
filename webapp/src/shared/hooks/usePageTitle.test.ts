import { describe, expect, it } from "vitest";
import { formatPageTitle } from "./usePageTitle";

describe("formatPageTitle", () => {
  it("добавляет имя приложения к названию экрана", () => {
    expect(formatPageTitle("Карточки")).toBe("Карточки · RP");
  });

  it("обрезает пробелы по краям", () => {
    expect(formatPageTitle("  Алиса  ")).toBe("Алиса · RP");
  });

  it("без названия — только имя приложения", () => {
    expect(formatPageTitle(undefined)).toBe("RP");
    expect(formatPageTitle(null)).toBe("RP");
    expect(formatPageTitle("   ")).toBe("RP");
  });
});
