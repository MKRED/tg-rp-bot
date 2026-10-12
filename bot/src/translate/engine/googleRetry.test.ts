import { describe, expect, it } from "vitest";
import { googleRetryDelayMs, GoogleTranslateHttpError, isRetryableGoogleError } from "./googleRetry.js";

describe("isRetryableGoogleError", () => {
  it("429 и 5xx — повторяем", () => {
    expect(isRetryableGoogleError(new GoogleTranslateHttpError(429))).toBe(true);
    expect(isRetryableGoogleError(new GoogleTranslateHttpError(503))).toBe(true);
  });

  it("прочие 4xx — не повторяем", () => {
    expect(isRetryableGoogleError(new GoogleTranslateHttpError(400))).toBe(false);
    expect(isRetryableGoogleError(new GoogleTranslateHttpError(403))).toBe(false);
  });

  it("сетевой сбой — повторяем", () => {
    expect(isRetryableGoogleError(new TypeError("fetch failed"))).toBe(true);
  });

  it("сообщение прежнее", () => {
    expect(new GoogleTranslateHttpError(429).message).toBe("Google Translate HTTP 429");
  });
});

describe("googleRetryDelayMs", () => {
  it("без Retry-After — удвоение: 2 с, 4 с", () => {
    expect(googleRetryDelayMs(1, null)).toBe(2000);
    expect(googleRetryDelayMs(2, null)).toBe(4000);
  });

  it("Retry-After в секундах", () => {
    expect(googleRetryDelayMs(1, "3")).toBe(3000);
  });

  it("Retry-After датой", () => {
    const now = Date.parse("2026-10-12T00:00:00Z");
    expect(googleRetryDelayMs(1, "Mon, 12 Oct 2026 00:00:05 GMT", now)).toBe(5000);
  });

  it("не больше 10 с", () => {
    expect(googleRetryDelayMs(1, "120")).toBe(10_000);
    expect(googleRetryDelayMs(5, null)).toBe(10_000);
  });

  it("непонятный Retry-After — удвоение", () => {
    expect(googleRetryDelayMs(1, "скоро")).toBe(2000);
  });
});
