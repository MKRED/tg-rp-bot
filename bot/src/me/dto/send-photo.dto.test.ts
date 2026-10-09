import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { SendPhotoDto } from "./send-photo.dto.js";

/**
 * Характеризационная таблица: тело запроса → разобранный запрос или текст 400, как у Hono-контроллера.
 * Hono останавливался на первой ошибке; ValidationPipe склеивает все — поэтому в строках с одной
 * ошибкой текст совпадает дословно, а для нескольких сразу проверяем только первую.
 */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: SendPhotoDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

const IMG = "data:image/jpeg;base64,AAAA";
const ok = { image: IMG, label: "Алиса", deepLink: "/characters/12" };

describe("SendPhotoDto", () => {
  it.each([
    { body: ok, out: ok },
    { body: { ...ok, deepLink: "/personas/3", extra: 1 }, out: { ...ok, deepLink: "/personas/3" } },
    { body: { ...ok, label: "  Алиса \n" }, out: ok },
    { body: { ...ok, label: "x".repeat(70) }, out: { ...ok, label: "x".repeat(64) } },
    { body: { ...ok, label: ` ${"y".repeat(64)}z` }, out: { ...ok, label: "y".repeat(64) } },
    { body: { ...ok, image: undefined }, out: "Image is required" },
    { body: { ...ok, image: null }, out: "Image is required" },
    { body: { ...ok, image: "" }, out: "Image must be a data:image/* URL" },
    { body: { ...ok, image: 5 }, out: "Image must be a data:image/* URL" },
    { body: { ...ok, image: "http://x/y.png" }, out: "Image must be a data:image/* URL" },
    { body: { ...ok, image: `data:image/png;base64,${"A".repeat(2_500_000)}` }, out: "Image too large" },
    { body: { ...ok, label: "   " }, out: "Label is required" },
    { body: { ...ok, label: 7 }, out: "Label is required" },
    { body: { ...ok, label: undefined }, out: "Label is required" },
    { body: { ...ok, deepLink: "https://evil.example/characters/1" }, out: "Invalid deepLink" },
    { body: { ...ok, deepLink: "/characters/abc" }, out: "Invalid deepLink" },
    { body: { ...ok, deepLink: "/books/1" }, out: "Invalid deepLink" },
    { body: { ...ok, deepLink: 12 }, out: "Invalid deepLink" },
    { body: { ...ok, deepLink: undefined }, out: "Invalid deepLink" },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });

  it("несколько ошибок сразу — 400, первой идёт та же, что у Hono", async () => {
    const res = await parse({});
    expect(typeof res).toBe("string");
    expect((res as string).startsWith("Image is required")).toBe(true);
  });
});
