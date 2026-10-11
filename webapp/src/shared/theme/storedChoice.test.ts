import { describe, expect, it } from "vitest";
import { parseStoredChoice } from "./storedChoice";

const OPTIONS = { amber: 1, teal: 2 };

describe("parseStoredChoice", () => {
  it("возвращает сохранённый вариант, если он есть среди вариантов", () => {
    expect(parseStoredChoice("teal", OPTIONS, "amber")).toBe("teal");
  });

  it("иначе — fallback", () => {
    expect(parseStoredChoice(null, OPTIONS, "amber")).toBe("amber");
    expect(parseStoredChoice("violet", OPTIONS, "amber")).toBe("amber");
    expect(parseStoredChoice("toString", OPTIONS, "amber")).toBe("amber");
  });
});
