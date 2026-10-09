import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { EditStoryBeatDto } from "./edit-story-beat.dto.js";

/** Характеризационная таблица: тело правки бита → content или текст 400, как у Hono. */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: EditStoryBeatDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

describe("EditStoryBeatDto", () => {
  it.each([
    { body: { content: "Бит" }, out: { content: "Бит" } },
    { body: { content: "  Бит\n" }, out: { content: "Бит" } },
    { body: { content: "  " }, out: "content is required" },
    { body: { content: 1 }, out: "content is required" },
    { body: {}, out: "content is required" },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
