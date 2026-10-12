import { describe, expect, it } from "vitest";
import { TranslatorCaptchaError, TranslatorHttpError } from "./translatorRetry.js";
import { parseYandexResponse } from "./yandexResponse.js";

const JSON_TYPE = "application/json; charset=utf-8";

function error(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected to throw");
}

describe("parseYandexResponse", () => {
  it("успех — склеенный text", () => {
    expect(parseYandexResponse(200, JSON_TYPE, '{"code":200,"lang":"ru-en","text":["Hello", " world"]}')).toBe("Hello world");
  });

  it("код ошибки в теле при HTTP 200 — TranslatorHttpError с этим кодом", () => {
    const err = error(() => parseYandexResponse(200, JSON_TYPE, '{"code":413,"message":"Text too long"}'));
    expect(err).toBeInstanceOf(TranslatorHttpError);
    expect((err as TranslatorHttpError).status).toBe(413);
  });

  it("HTML при 200 — капча", () => {
    expect(error(() => parseYandexResponse(200, "text/html; charset=utf-8", "<html>captcha</html>"))).toBeInstanceOf(
      TranslatorCaptchaError,
    );
  });

  it("HTTP 429 без JSON — TranslatorHttpError с Retry-After", () => {
    const err = error(() => parseYandexResponse(429, "text/html", "Too many", "5")) as TranslatorHttpError;
    expect(err).toBeInstanceOf(TranslatorHttpError);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe("5");
  });

  it("JSON без text при code 200 — 502 (не молча пустой перевод)", () => {
    expect((error(() => parseYandexResponse(200, JSON_TYPE, '{"code":200}')) as TranslatorHttpError).status).toBe(502);
  });

  it("битый JSON — ошибка", () => {
    expect(error(() => parseYandexResponse(200, JSON_TYPE, "{oops"))).toBeInstanceOf(Error);
  });
});
