import { sign } from "@tma.js/init-data-node";
import { describe, expect, it } from "vitest";
import { authenticateInitData } from "./initData.js";

const BOT_TOKEN = "123456:test-token";
const user = { id: 42, first_name: "Alice", username: "alice" };

function signed(token = BOT_TOKEN, authDate = new Date()): string {
  return sign({ user }, token, authDate);
}

describe("authenticateInitData", () => {
  it("валидная подпись — пользователь из initData", () => {
    const result = authenticateInitData(`tma ${signed()}`, { botToken: BOT_TOKEN, devUserId: undefined });
    expect(result).toMatchObject({ ok: true, devBypass: false, user: { id: 42, username: "alice" } });
  });

  it("подпись другим токеном — отказ с причиной", () => {
    const result = authenticateInitData(`tma ${signed("999:other")}`, {
      botToken: BOT_TOKEN,
      devUserId: undefined,
    });
    expect(result).toMatchObject({ ok: false, error: "Invalid Telegram init data" });
    expect(result.ok === false && result.cause).toBeTruthy();
  });

  it("просроченный initData (старше суток) — отказ", () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = authenticateInitData(`tma ${signed(BOT_TOKEN, old)}`, {
      botToken: BOT_TOKEN,
      devUserId: undefined,
    });
    expect(result.ok).toBe(false);
  });

  it("без заголовка и без dev-обхода — Missing", () => {
    expect(authenticateInitData(undefined, { botToken: BOT_TOKEN, devUserId: undefined })).toEqual({
      ok: false,
      error: "Missing Telegram init data",
    });
    expect(authenticateInitData("tma ", { botToken: BOT_TOKEN, devUserId: undefined }).ok).toBe(false);
  });

  it("без заголовка при dev-обходе — фейковый пользователь с devUserId", () => {
    expect(authenticateInitData(undefined, { botToken: BOT_TOKEN, devUserId: -1000000001 })).toEqual({
      ok: true,
      devBypass: true,
      user: { id: -1000000001, first_name: "Dev" },
    });
  });

  it("dev-обход не отменяет проверку присланной подписи", () => {
    const result = authenticateInitData("tma garbage", { botToken: BOT_TOKEN, devUserId: -1000000001 });
    expect(result.ok).toBe(false);
  });
});
