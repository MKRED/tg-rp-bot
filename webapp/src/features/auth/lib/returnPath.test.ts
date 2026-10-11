import { describe, expect, it } from "vitest";
import { loginPath, safeReturnPath } from "./returnPath";

describe("loginPath", () => {
  it("кодирует путь возврата в from", () => {
    expect(loginPath("/characters/5")).toBe("/login?from=%2Fcharacters%2F5");
    expect(loginPath("/chats?tab=1")).toBe("/login?from=%2Fchats%3Ftab%3D1");
  });

  it("без from для главной, пустого пути и самого входа", () => {
    expect(loginPath()).toBe("/login");
    expect(loginPath("/")).toBe("/login");
    expect(loginPath("/login")).toBe("/login");
    expect(loginPath("/login?from=%2Fx")).toBe("/login");
  });
});

describe("safeReturnPath", () => {
  it("пропускает внутренние пути", () => {
    expect(safeReturnPath("/characters/5")).toBe("/characters/5");
    expect(safeReturnPath("/chats?tab=1")).toBe("/chats?tab=1");
  });

  it("всё прочее — на главную", () => {
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath("")).toBe("/");
    expect(safeReturnPath("characters")).toBe("/");
    expect(safeReturnPath("//evil.com")).toBe("/");
    expect(safeReturnPath("/\\evil.com")).toBe("/");
    expect(safeReturnPath("https://evil.com")).toBe("/");
    expect(safeReturnPath("/redirect?u=https://evil.com")).toBe("/");
  });

  it("не возвращает на экран входа (петля)", () => {
    expect(safeReturnPath("/login")).toBe("/");
    expect(safeReturnPath("/login?from=%2Fx")).toBe("/");
  });
});
