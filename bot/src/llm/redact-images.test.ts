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

  it("Responses: картинки в user-сообщении и в результате инструмента", () => {
    const url = `data:image/png;base64,${"B".repeat(2048)}`;
    const body = {
      input: [
        { role: "system", content: "sys" },
        { role: "user", content: [{ type: "input_text", text: "t" }, { type: "input_image", image_url: url }] },
        { type: "function_call_output", call_id: "c1", output: [{ type: "input_image", image_url: url }] },
        { type: "function_call_output", call_id: "c2", output: "plain" },
      ],
    };
    const redacted = redactImageUrls(body).input as typeof body.input;
    expect(redacted[1]).toEqual({
      role: "user",
      content: [{ type: "input_text", text: "t" }, { type: "input_image", image_url: "data:image/png;base64,… (2 КБ)" }],
    });
    expect(redacted[2]).toMatchObject({ output: [{ type: "input_image", image_url: "data:image/png;base64,… (2 КБ)" }] });
    expect(redacted[3]).toEqual(body.input[3]);
    expect((body.input[2] as { output: Array<{ image_url: string }> }).output[0]!.image_url).toBe(url);
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
