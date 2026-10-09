import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { ListChatsQueryDto } from "./list-chats-query.dto.js";

/**
 * Характеризационная таблица: query GET /api/chats → страница и размер. legacyDiffers — случаи, на
 * которых Hono передавал NaN/дробь в SQL (500), а DTO берёт дефолт или отбрасывает дробную часть.
 */
const pipe = createValidationPipe();
async function parse(query: unknown): Promise<object> {
  return { ...((await pipe.transform(query, { type: "query", metatype: ListChatsQueryDto })) as object) };
}

export const LIST_CHATS_CASES: { query: Record<string, unknown>; out: object; legacyDiffers?: true }[] = [
  { query: {}, out: { page: 1, pageSize: 20 } },
  { query: { page: "3", pageSize: "10" }, out: { page: 3, pageSize: 10 } },
  { query: { page: "0", pageSize: "0" }, out: { page: 1, pageSize: 1 } },
  { query: { page: "-5", pageSize: "-1" }, out: { page: 1, pageSize: 1 } },
  { query: { page: "", pageSize: "" }, out: { page: 1, pageSize: 1 } },
  { query: { pageSize: "500" }, out: { page: 1, pageSize: 50 } },
  { query: { pageSize: "50" }, out: { page: 1, pageSize: 50 } },
  { query: { page: ["2", "7"] }, out: { page: 2, pageSize: 20 } },
  { query: { page: "abc", pageSize: "x" }, out: { page: 1, pageSize: 20 }, legacyDiffers: true },
  { query: { page: "2.7", pageSize: "10.9" }, out: { page: 2, pageSize: 10 }, legacyDiffers: true },
];

describe("ListChatsQueryDto", () => {
  it.each(LIST_CHATS_CASES)("$query → $out", async ({ query, out }) => {
    expect(await parse(query)).toEqual(out);
  });
});
