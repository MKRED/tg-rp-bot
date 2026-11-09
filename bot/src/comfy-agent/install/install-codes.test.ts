import { describe, expect, it } from "vitest";
import { InstallCodes } from "./install-codes.js";

function setup() {
  let now = 1_000;
  const codes = new InstallCodes(600_000, () => now);
  return { codes, advance: (ms: number) => (now += ms) };
}

describe("InstallCodes", () => {
  it("код срабатывает один раз", () => {
    const { codes } = setup();
    const { code } = codes.issue("u1");
    expect(codes.redeem(code)).toBe("u1");
    expect(codes.redeem(code)).toBeNull();
  });

  it("истёкший код не срабатывает", () => {
    const { codes, advance } = setup();
    const { code, expiresAt } = codes.issue("u1");
    expect(expiresAt).toBe(601_000);
    advance(600_000);
    expect(codes.redeem(code)).toBeNull();
  });

  it("новый код отменяет прежний того же пользователя, чужие не трогает", () => {
    const { codes } = setup();
    const first = codes.issue("u1").code;
    const other = codes.issue("u2").code;
    const second = codes.issue("u1").code;
    expect(codes.redeem(first)).toBeNull();
    expect(codes.redeem(other)).toBe("u2");
    expect(codes.redeem(second)).toBe("u1");
  });

  it("неизвестный код — null", () => {
    expect(setup().codes.redeem("nope")).toBeNull();
  });
});
