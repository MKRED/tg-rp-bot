import { describe, expect, it } from "vitest";
import { generationStatusErrorMessage } from "./generationErrors";

describe("generationStatusErrorMessage", () => {
  it("известный код — его текст", () => {
    expect(generationStatusErrorMessage("busy")).toBe("Генерация уже идёт, подождите");
  });

  it("no_api_key — подсказка про настройки", () => {
    expect(generationStatusErrorMessage("no_api_key")).toContain("Настройки");
  });

  it("незнакомый код — общий текст, а не сам код", () => {
    expect(generationStatusErrorMessage("generation_failed")).toBe("Не удалось сгенерировать блок");
  });
});
