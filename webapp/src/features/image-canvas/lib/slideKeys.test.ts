import { describe, expect, it } from "vitest";
import { slideKeyDelta } from "./slideKeys";

const key = (k: string, extra: Partial<Parameters<typeof slideKeyDelta>[0]> = {}) => ({
  key: k,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  defaultPrevented: false,
  ...extra,
});

describe("slideKeyDelta", () => {
  it("стрелки листают назад и вперёд", () => {
    expect(slideKeyDelta(key("ArrowLeft"))).toBe(-1);
    expect(slideKeyDelta(key("ArrowRight"))).toBe(1);
  });

  it("прочие клавиши и стрелки с модификаторами не листают", () => {
    expect(slideKeyDelta(key("ArrowUp"))).toBeNull();
    expect(slideKeyDelta(key("ArrowLeft", { altKey: true }))).toBeNull();
    expect(slideKeyDelta(key("ArrowRight", { shiftKey: true }))).toBeNull();
    expect(slideKeyDelta(key("ArrowRight", { defaultPrevented: true }))).toBeNull();
  });
});
