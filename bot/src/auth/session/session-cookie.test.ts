import { describe, expect, it } from "vitest";
import { readCookie, sessionCookieOptions } from "./session-cookie.js";

describe("readCookie", () => {
  it("находит нужную cookie среди нескольких", () => {
    expect(readCookie("a=1; tgrp_session=abc_-1; b=2")).toBe("abc_-1");
    expect(readCookie("tgrp_session=xyz")).toBe("xyz");
  });

  it("нет заголовка, нет cookie, пустое значение — undefined", () => {
    expect(readCookie(undefined)).toBeUndefined();
    expect(readCookie("a=1; b=2")).toBeUndefined();
    expect(readCookie("tgrp_session=")).toBeUndefined();
  });

  it("не путает с cookie, у которой имя — суффикс/префикс", () => {
    expect(readCookie("old_tgrp_session=1; tgrp_session_x=2")).toBeUndefined();
  });

  it("битое %-кодирование — undefined, не исключение", () => {
    expect(readCookie("tgrp_session=%E0%A4%A")).toBeUndefined();
  });
});

describe("sessionCookieOptions", () => {
  it("httpOnly + SameSite=Lax + path /api; Secure по флагу", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/api" });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
