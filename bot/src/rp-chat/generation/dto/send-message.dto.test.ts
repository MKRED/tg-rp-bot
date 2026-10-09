import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { SendMessageDto } from "./send-message.dto.js";

/** Характеризационная таблица: тело отправки/правки → content или текст 400, как у Hono. */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: SendMessageDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

const MSG = "content is required";

describe("SendMessageDto", () => {
  it.each([
    { body: { content: "Привет" }, out: { content: "Привет" } },
    { body: { content: "  Привет\n\n" }, out: { content: "Привет" } },
    { body: { content: "a", extra: 1 }, out: { content: "a" } },
    { body: {}, out: MSG },
    { body: { content: "   " }, out: MSG },
    { body: { content: 5 }, out: MSG },
    { body: { content: null }, out: MSG },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
