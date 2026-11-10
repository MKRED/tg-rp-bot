import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { MAX_SEND_PHOTO_CHARS } from "@tg-rp-bot/shared";
import { SendPhotoDto } from "./send-photo.dto.js";

/**
 * Характеризационная таблица: тело запроса → разобранный запрос или текст 400, как у Hono-контроллера.
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
const ok = { image: IMG };
// Вариант холста 2048 px в JPEG — больше лимита полного фото персонажа (2,5 млн), но проходит.
const ok4m = { image: `data:image/jpeg;base64,${"A".repeat(4_000_000)}` };

describe("SendPhotoDto", () => {
  it.each([
    { body: ok, out: ok },
    // Старый webapp ещё шлёт подпись и ссылку — их отбрасываем, а не отклоняем запрос.
    { body: { ...ok, label: "Алиса", deepLink: "/characters/12" }, out: ok },
    { body: { image: undefined }, out: "Image is required" },
    { body: { image: null }, out: "Image is required" },
    { body: { image: "" }, out: "Image must be a data:image/* URL" },
    { body: { image: 5 }, out: "Image must be a data:image/* URL" },
    { body: { image: "http://x/y.png" }, out: "Image must be a data:image/* URL" },
    { body: { image: `data:image/jpeg;base64,${"A".repeat(4_000_000)}` }, out: ok4m },
    { body: { image: `data:image/png;base64,${"A".repeat(MAX_SEND_PHOTO_CHARS)}` }, out: "Image too large" },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });

  it("пустое тело — 400 «Image is required»", async () => {
    expect(await parse({})).toBe("Image is required");
  });
});
