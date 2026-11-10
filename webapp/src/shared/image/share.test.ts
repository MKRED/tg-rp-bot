import { describe, expect, it } from "vitest";
import { extensionFor } from "./share";

describe("extensionFor", () => {
  it("частые типы картинок", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/svg+xml")).toBe("svg");
  });

  it("параметры и регистр не мешают", () => {
    expect(extensionFor("IMAGE/JPEG; charset=binary")).toBe("jpg");
  });

  it("непонятный тип — png", () => {
    expect(extensionFor("")).toBe("png");
    expect(extensionFor("application/x-weird+thing")).toBe("png");
  });
});
