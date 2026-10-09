import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { assertValidKeyFormat, isValidKeyFormat } from "./key-format.js";

describe("isValidKeyFormat", () => {
  it.each([
    ["sk-abc123", true],
    ["", false],
    ["sk-abc 123", false],
    ["sk-abc\n123", false],
    ["sk-abc\t123", false],
    ["x".repeat(200), true],
    ["x".repeat(201), false],
  ])("%j → %s", (key, expected) => {
    expect(isValidKeyFormat(key)).toBe(expected);
  });
});

describe("assertValidKeyFormat", () => {
  it("null/undefined (удалить / не трогать) не проверяются", () => {
    expect(() => assertValidKeyFormat(null)).not.toThrow();
    expect(() => assertValidKeyFormat(undefined)).not.toThrow();
    expect(() => assertValidKeyFormat("sk-ok")).not.toThrow();
  });

  it("плохой ключ — 400 { error: invalid_key_format, message }", () => {
    const err = (() => {
      try {
        assertValidKeyFormat("sk bad");
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toEqual({
      error: "invalid_key_format",
      message: expect.any(String),
    });
  });
});
