import { describe, expect, it } from "vitest";
import { redactImageUrls } from "./redact-images.js";

describe("redactImageUrls", () => {
  it("заменяет data URL картинок описанием, остальное — как есть", () => {
    const url = `data:image/jpeg;base64,${"A".repeat(4096)}`;
    const body = {
      model: "m",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: [{ type: "text", text: "t" }, { type: "image_url", image_url: { url } }] },
      ],
    };
    expect(redactImageUrls(body)).toEqual({
      model: "m",
      messages: [
        { role: "system", content: "sys" },
        {
          role: "user",
          content: [{ type: "text", text: "t" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,… (4 КБ)" } }],
        },
      ],
    });
    expect(body.messages[1]!.content[1]).toEqual({ type: "image_url", image_url: { url } });
  });

  it("https-ссылку не трогает; тело без messages возвращает как есть", () => {
    const part = { type: "image_url", image_url: { url: "https://x/y.png" } };
    expect(redactImageUrls({ messages: [{ role: "user", content: [part] }] })).toEqual({
      messages: [{ role: "user", content: [part] }],
    });
    const noMessages = { model: "m" };
    expect(redactImageUrls(noMessages)).toBe(noMessages);
  });
});
