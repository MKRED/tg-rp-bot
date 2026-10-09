import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { AvatarBatchDto } from "./avatar-batch.dto.js";

/**
 * Характеризационная таблица: тело запроса → дескрипторы или 400, как у Hono-контроллера.
 * Некорректные дескрипторы молча выпадают; 400 — только когда refs не массив. Лимит размера
 * батча проверяет сервис (после отсева).
 */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<unknown> {
  try {
    return ((await pipe.transform(body, { type: "body", metatype: AvatarBatchDto })) as AvatarBatchDto).refs.map((r) => ({ ...r }));
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

const MSG = "refs must be an array";
const c1 = { type: "character", id: 1 };
const p2 = { type: "persona", id: 2 };

describe("AvatarBatchDto", () => {
  it.each([
    { body: { refs: [c1, p2] }, out: [c1, p2] },
    { body: { refs: [] }, out: [] },
    { body: { refs: [{ ...c1, extra: "x" }] }, out: [c1] },
    {
      body: { refs: [c1, { type: "book", id: 3 }, { type: "persona", id: "4" }, { type: "persona", id: 1.5 }, null, 7, "x", [], p2] },
      out: [c1, p2],
    },
    { body: { refs: [{ type: "character", id: -5 }, { type: "persona", id: 0 }] }, out: [{ type: "character", id: -5 }, { type: "persona", id: 0 }] },
    { body: { refs: Array.from({ length: 61 }, () => c1) }, out: Array.from({ length: 61 }, () => c1) },
    { body: {}, out: MSG },
    { body: { refs: null }, out: MSG },
    { body: { refs: c1 }, out: MSG },
    { body: { refs: "[]" }, out: MSG },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
