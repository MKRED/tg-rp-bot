import { describe, expect, it } from "vitest";
import { parseCardInput } from "./cards.validation.js";

describe("parseCardInput", () => {
  it("отклоняет тело, которое не объект", () => {
    expect(parseCardInput(null)).toEqual({ error: "Body must be an object" });
    expect(parseCardInput("строка")).toEqual({ error: "Body must be an object" });
  });

  it("отклоняет тело без имени", () => {
    expect(parseCardInput({})).toEqual({ error: "Name is required" });
  });

  it("отклоняет пустое/пробельное имя", () => {
    expect(parseCardInput({ name: "   " })).toEqual({ error: "Name is required" });
  });

  it("принимает и обрезает имя по краям", () => {
    expect(parseCardInput({ name: "  Артур  " })).toEqual({ input: { name: "Артур" } });
  });
});
