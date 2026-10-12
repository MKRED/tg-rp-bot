import { describe, expect, it } from "vitest";
import { parseTranslateEngine, TRANSLATE_ENGINE_OPTIONS } from "./translate-engines";

describe("parseTranslateEngine", () => {
  it("известные методы — как есть", () => {
    expect(parseTranslateEngine("google")).toBe("google");
    expect(parseTranslateEngine("yandex")).toBe("yandex");
    expect(parseTranslateEngine("ai")).toBe("ai");
  });

  it("неизвестное, другой регистр, null — google", () => {
    expect(parseTranslateEngine("Yandex")).toBe("google");
    expect(parseTranslateEngine(null)).toBe("google");
    expect(parseTranslateEngine(1)).toBe("google");
  });

  it("в переключателе — все методы контракта", () => {
    expect(TRANSLATE_ENGINE_OPTIONS.map((o) => o.value)).toEqual(["google", "yandex", "ai"]);
  });
});
