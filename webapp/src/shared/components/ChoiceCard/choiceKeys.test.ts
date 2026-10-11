import { describe, expect, it } from "vitest";
import { nextChoiceIndex } from "./choiceKeys";

describe("nextChoiceIndex", () => {
  it("стрелки — по кругу", () => {
    expect(nextChoiceIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextChoiceIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextChoiceIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(nextChoiceIndex(1, "ArrowUp", 3)).toBe(0);
  });

  it("Home/End — крайние", () => {
    expect(nextChoiceIndex(1, "Home", 3)).toBe(0);
    expect(nextChoiceIndex(1, "End", 3)).toBe(2);
  });

  it("прочие клавиши и пустая группа — null", () => {
    expect(nextChoiceIndex(0, "Enter", 3)).toBeNull();
    expect(nextChoiceIndex(0, "ArrowRight", 0)).toBeNull();
  });
});
