import { describe, expect, it } from "vitest";
import {
  isRetryableTranslatorError,
  TranslatorCaptchaError,
  TranslatorHttpError,
  translatorRetryDelayMs,
} from "./translatorRetry.js";

describe("isRetryableTranslatorError", () => {
  it("429 и 5xx — повторяем", () => {
    expect(isRetryableTranslatorError(new TranslatorHttpError("Google", 429))).toBe(true);
    expect(isRetryableTranslatorError(new TranslatorHttpError("Yandex", 503))).toBe(true);
  });

  it("прочие 4xx — не повторяем (в т.ч. дневной лимит Яндекса 403)", () => {
    expect(isRetryableTranslatorError(new TranslatorHttpError("Google", 400))).toBe(false);
    expect(isRetryableTranslatorError(new TranslatorHttpError("Yandex", 403))).toBe(false);
  });

  it("капча и сетевой сбой — повторяем", () => {
    expect(isRetryableTranslatorError(new TranslatorCaptchaError("Yandex"))).toBe(true);
    expect(isRetryableTranslatorError(new TypeError("fetch failed"))).toBe(true);
  });

  it("сообщение называет переводчика", () => {
    expect(new TranslatorHttpError("Google", 429).message).toBe("Google Translate HTTP 429");
    expect(new TranslatorHttpError("Yandex", 413).message).toBe("Yandex Translate HTTP 413");
  });
});

describe("translatorRetryDelayMs", () => {
  it("без Retry-After — удвоение: 2 с, 4 с", () => {
    expect(translatorRetryDelayMs(1, null)).toBe(2000);
    expect(translatorRetryDelayMs(2, null)).toBe(4000);
  });

  it("Retry-After в секундах", () => {
    expect(translatorRetryDelayMs(1, "3")).toBe(3000);
  });

  it("Retry-After датой", () => {
    const now = Date.parse("2026-10-12T00:00:00Z");
    expect(translatorRetryDelayMs(1, "Mon, 12 Oct 2026 00:00:05 GMT", now)).toBe(5000);
  });

  it("не больше 10 с", () => {
    expect(translatorRetryDelayMs(1, "120")).toBe(10_000);
    expect(translatorRetryDelayMs(5, null)).toBe(10_000);
  });

  it("непонятный Retry-After — удвоение", () => {
    expect(translatorRetryDelayMs(1, "скоро")).toBe(2000);
  });
});
