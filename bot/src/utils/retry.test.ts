import { describe, expect, it, vi } from "vitest";
import { retry } from "./retry.js";

// Мокаем логгер, чтобы не тянуть config.ts (требует BOT_TOKEN) и pino-воркеры в юнит-тест.
vi.mock("../logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("retry", () => {
  it("возвращает результат с первой попытки без задержек", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retry(fn, 3, 0)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("повторяет до успеха и возвращает результат", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");
    await expect(retry(fn, 3, 0)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("пробрасывает последнюю ошибку, исчерпав попытки", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always"));
    await expect(retry(fn, 2, 0)).rejects.toThrow("always");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("не повторяет, если shouldRetry вернул false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));
    await expect(retry(fn, 5, 0, "Label", () => false)).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
