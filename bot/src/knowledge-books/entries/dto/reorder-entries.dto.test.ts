import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { ReorderEntriesDto } from "./reorder-entries.dto.js";

/** Характеризационная таблица: тело reorder → порядок или текст 400, как у Hono (parseReorderInput). */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: ReorderEntriesDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}
const MSG = "order must be an array of integers";

describe("ReorderEntriesDto", () => {
  it.each([
    { body: { order: [3, 1, 2] }, out: { order: [3, 1, 2] } },
    { body: { order: [] }, out: { order: [] } },
    { body: { order: [-1, 0] }, out: { order: [-1, 0] } },
    { body: { order: [1, 1] }, out: { order: [1, 1] } },
    { body: { order: [1], extra: 1 }, out: { order: [1] } },
    { body: {}, out: MSG },
    { body: { order: null }, out: MSG },
    { body: { order: "1,2" }, out: MSG },
    { body: { order: [1, "2"] }, out: MSG },
    { body: { order: [1.5] }, out: MSG },
    { body: { order: [1, null] }, out: MSG },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
