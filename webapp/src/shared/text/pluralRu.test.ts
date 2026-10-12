import { describe, expect, it } from "vitest";
import { pluralRu } from "./pluralRu";

const FORMS = ["запись", "записи", "записей"] as const;

describe("pluralRu", () => {
  it("одна: 1, 21, 101", () => {
    for (const n of [1, 21, 101]) expect(pluralRu(n, FORMS)).toBe("запись");
  });

  it("несколько: 2–4, 22–24", () => {
    for (const n of [2, 3, 4, 22, 24]) expect(pluralRu(n, FORMS)).toBe("записи");
  });

  it("много: 0, 5–20, 11–14 и 111–114", () => {
    for (const n of [0, 5, 11, 12, 14, 20, 25, 111, 114]) expect(pluralRu(n, FORMS)).toBe("записей");
  });
});
