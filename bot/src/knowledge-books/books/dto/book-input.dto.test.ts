import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { BookInputDto } from "./book-input.dto.js";

/** Характеризационная таблица: тело книги → ввод или текст 400, как у Hono-разбора (parseBookInput). */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: BookInputDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}
const long = "б".repeat(2100);

describe("BookInputDto", () => {
  it.each([
    { body: { name: "Мир" }, out: { name: "Мир", description: null } },
    { body: { name: "  Мир  ", description: "  Про мир  " }, out: { name: "Мир", description: "Про мир" } },
    { body: { name: long, description: long }, out: { name: long.slice(0, 100), description: long.slice(0, 2000) } },
    { body: { name: ` ${"в".repeat(100)}г` }, out: { name: "в".repeat(100), description: null } },
    { body: { name: "Мир", description: "   " }, out: { name: "Мир", description: null } },
    { body: { name: "Мир", description: 5 }, out: { name: "Мир", description: null } },
    { body: { name: "Мир", description: null, extra: 1 }, out: { name: "Мир", description: null } },
    { body: {}, out: "Name is required" },
    { body: { name: "  " }, out: "Name is required" },
    { body: { name: 7 }, out: "Name is required" },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
