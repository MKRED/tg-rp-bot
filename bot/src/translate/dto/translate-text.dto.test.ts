import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { TranslateTextDto } from "./translate-text.dto.js";

/**
 * Характеризационная таблица: тело запроса → разобранный запрос или 400, как у Hono-контроллера.
 * Не-строки в blocks молча выкидываются, языки обрезаются, любой mode кроме "ai" — google.
 */
const MSG = "blocks (1..500), sourceLang and targetLang are required";
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: TranslateTextDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

const ok = { blocks: ["a"], sourceLang: "ru", targetLang: "en" };
const many = Array.from({ length: 500 }, () => "x");

describe("TranslateTextDto", () => {
  it.each([
    { body: ok, out: { ...ok, mode: "google" } },
    { body: { ...ok, mode: "ai" }, out: { ...ok, mode: "ai" } },
    { body: { ...ok, mode: "AI" }, out: { ...ok, mode: "google" } },
    { body: { ...ok, mode: 1 }, out: { ...ok, mode: "google" } },
    { body: { ...ok, sourceLang: "  ru ", targetLang: "\ten\n" }, out: { ...ok, mode: "google" } },
    { body: { ...ok, blocks: ["a", 1, null, "", "b"] }, out: { ...ok, blocks: ["a", "", "b"], mode: "google" } },
    { body: { ...ok, blocks: many }, out: { ...ok, blocks: many, mode: "google" } },
    { body: { ...ok, blocks: [...many, 7] }, out: { ...ok, blocks: many, mode: "google" } },
    { body: { ...ok, extra: 1 }, out: { ...ok, mode: "google" } },
    { body: {}, out: MSG },
    { body: { ...ok, blocks: [] }, out: MSG },
    { body: { ...ok, blocks: [1, 2] }, out: MSG },
    { body: { ...ok, blocks: "a" }, out: MSG },
    { body: { ...ok, blocks: [...many, "y"] }, out: MSG },
    { body: { ...ok, sourceLang: "   " }, out: MSG },
    { body: { ...ok, targetLang: 5 }, out: MSG },
    { body: { ...ok, sourceLang: undefined }, out: MSG },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
