import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { RenameChatDto } from "./rename-chat.dto.js";

/** Характеризационная таблица: тело PATCH /api/chats/:id → title или текст 400, как у Hono. */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: RenameChatDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

const MSG = "title must be a string";

export const RENAME_CHAT_CASES: { body: unknown; out: object | string }[] = [
  { body: { title: "Таверна" }, out: { title: "Таверна" } },
  // trim и пусто → null делает репозиторий, DTO только обрезает длину
  { body: { title: "  Таверна  " }, out: { title: "  Таверна  " } },
  { body: { title: "" }, out: { title: "" } },
  { body: { title: "я".repeat(150) }, out: { title: "я".repeat(100) } },
  { body: { title: "x", extra: 1 }, out: { title: "x" } },
  { body: {}, out: MSG },
  { body: { title: null }, out: MSG },
  { body: { title: 5 }, out: MSG },
  { body: { title: ["a"] }, out: MSG },
];

describe("RenameChatDto", () => {
  it.each(RENAME_CHAT_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
