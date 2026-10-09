import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { EntryInputDto } from "./entry-input.dto.js";

/**
 * Характеризационная таблица: тело записи книги → нормализованный ввод или текст 400, как у
 * Hono-разбора (parseEntryInput). Hono останавливался на первой ошибке, ValidationPipe склеивает
 * все через «; » — поэтому сверяем первую (порядок правил тот же).
 */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: EntryInputDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}
const firstError = (out: object | string) => (typeof out === "string" ? out.split("; ")[0] : out);

const base = { name: "Запись" };
const DEFAULTS = {
  name: "Запись",
  enabled: true,
  activation: "always_on",
  characterId: null,
  personaId: null,
  alias: "",
  content: "",
  keywords: [],
  keywordDepth: 10,
};
const long = "а".repeat(150);

describe("EntryInputDto", () => {
  it.each([
    { body: { ...base, characterId: 1, alias: "Странник" }, out: { ...DEFAULTS, characterId: 1, alias: "Странник" } },
    { body: { ...base, personaId: 5, alias: " Артур " }, out: { ...DEFAULTS, personaId: 5, alias: "Артур" } },
    { body: { ...base, content: "Факт о мире" }, out: { ...DEFAULTS, content: "Факт о мире" } },
    { body: { name: `  ${long}`, content: "  x  " }, out: { ...DEFAULTS, name: long.slice(0, 100), content: "  x  " } },
    { body: { ...base, content: "x", alias: long }, out: { ...DEFAULTS, content: "x", alias: long.slice(0, 100) } },
    { body: { ...base, content: "x", enabled: false }, out: { ...DEFAULTS, content: "x", enabled: false } },
    { body: { ...base, content: "x", enabled: 0 }, out: { ...DEFAULTS, content: "x" } },
    { body: { ...base, content: "x", enabled: "false" }, out: { ...DEFAULTS, content: "x" } },
    { body: { ...base, content: "x", activation: "KEYWORD" }, out: { ...DEFAULTS, content: "x" } },
    { body: { ...base, characterId: "1", content: "x" }, out: { ...DEFAULTS, content: "x" } },
    { body: { ...base, characterId: 1.5 }, out: { ...DEFAULTS, characterId: 1.5 } },
    { body: { ...base, content: 5, personaId: 2 }, out: { ...DEFAULTS, personaId: 2 } },
    {
      body: { ...base, content: "Факт", activation: "keyword", keywords: [" меч ", "клинок", 5, "  ", long], keywordDepth: 25 },
      out: { ...DEFAULTS, content: "Факт", activation: "keyword", keywords: ["меч", "клинок", long.slice(0, 100)], keywordDepth: 25 },
    },
    { body: { ...base, content: "x", keywords: "меч" }, out: { ...DEFAULTS, content: "x" } },
    { body: { ...base, content: "x", keywords: ["меч"] }, out: { ...DEFAULTS, content: "x", keywords: ["меч"] } },
    { body: { ...base, content: "x", keywordDepth: -5 }, out: { ...DEFAULTS, content: "x", keywordDepth: 1 } },
    { body: { ...base, content: "x", keywordDepth: 10_000 }, out: { ...DEFAULTS, content: "x", keywordDepth: 200 } },
    { body: { ...base, content: "x", keywordDepth: 12.9 }, out: { ...DEFAULTS, content: "x", keywordDepth: 12 } },
    { body: { ...base, content: "x", keywordDepth: -0.5 }, out: { ...DEFAULTS, content: "x", keywordDepth: 1 } },
    { body: { ...base, content: "x", keywordDepth: "42" }, out: { ...DEFAULTS, content: "x" } },
    { body: { ...base, content: "x", keywordDepth: Infinity }, out: { ...DEFAULTS, content: "x", keywordDepth: 200 } },
    { body: { ...base, content: "x", extra: 1 }, out: { ...DEFAULTS, content: "x" } },
    { body: { content: "Текст" }, out: "Name is required" },
    { body: { name: "   ", content: "Текст" }, out: "Name is required" },
    { body: { name: 5, content: "Текст" }, out: "Name is required" },
    { body: {}, out: "Name is required" },
    { body: { ...base, characterId: 1, personaId: 2 }, out: "Entry cannot reference both a character and a persona" },
    { body: { ...base, content: "   " }, out: "Entry needs a character, a persona or content" },
    { body: { ...base }, out: "Entry needs a character, a persona or content" },
    { body: { ...base, content: "Факт", activation: "keyword", keywords: [] }, out: "Keyword activation requires at least one keyword" },
    { body: { ...base, content: "Факт", activation: "keyword", keywords: ["  ", ""] }, out: "Keyword activation requires at least one keyword" },
    { body: { ...base, characterId: 1, activation: "keyword" }, out: "Keyword activation requires at least one keyword" },
    { body: { characterId: 1, personaId: 2 }, out: "Name is required" },
    { body: { ...base, characterId: 1, personaId: 2, activation: "keyword" }, out: "Entry cannot reference both a character and a persona" },
  ])("$body → $out", async ({ body, out }) => {
    expect(firstError(await parse(body))).toEqual(out);
  });
});
