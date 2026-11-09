import { describe, expect, it } from "vitest";
import { decodeImageDataUrl, extensionFor, pngSize, toDataUrl } from "./data-url.js";
import { buildMultipart } from "./multipart.js";

// PNG 3×2: сигнатура и начало чанка IHDR (длина, тип, ширина, высота).
const PNG = Buffer.from("89504e470d0a1a0a0000000d494844520000000300000002080600000000", "hex");

describe("data URL", () => {
  it("кодирует и разбирает обратно", () => {
    const url = toDataUrl("image/png", PNG);
    expect(decodeImageDataUrl(url)).toEqual({ mime: "image/png", data: PNG });
    expect(decodeImageDataUrl("data:text/plain;base64,aGk=")).toBeNull();
    expect(decodeImageDataUrl("не data url")).toBeNull();
  });

  it("размер PNG из IHDR", () => {
    expect(pngSize(PNG)).toEqual({ width: 3, height: 2 });
    expect(pngSize(Buffer.from("not a png at all, really long enough"))).toBeNull();
  });

  it("расширение по MIME", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
  });
});

describe("buildMultipart", () => {
  it("поля и файл с границей из заголовка", () => {
    const { body, contentType } = buildMultipart({ subfolder: "tg-rp-bot", overwrite: "true" }, [
      { field: "image", filename: "a.png", contentType: "image/png", data: PNG },
    ]);
    const boundary = contentType.split("boundary=")[1]!;
    const text = body.toString("latin1");
    expect(text.startsWith(`--${boundary}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\ntg-rp-bot\r\n`)).toBe(true);
    expect(text).toContain('name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n');
    expect(body.includes(PNG)).toBe(true);
    expect(text.endsWith(`--${boundary}--\r\n`)).toBe(true);
  });
});
