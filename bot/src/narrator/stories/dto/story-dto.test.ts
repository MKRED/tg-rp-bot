import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { CreateStoryDto } from "./create-story.dto.js";
import { ListStoriesQueryDto } from "./list-stories-query.dto.js";
import { UpdateStoryDto } from "./update-story.dto.js";

/** Характеризационные таблицы DTO историй: вход → поля или текст 400, как у Hono. */
const pipe = createValidationPipe();
async function parse(value: unknown, metatype: new () => object, type: "body" | "query" = "body"): Promise<object | string> {
  try {
    const dto = (await pipe.transform(value, { type, metatype })) as object;
    return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

const OK = { bookId: 1, templateId: 2, presetId: 3, openingBeat: "Начало", premise: "" };

/** Hono отдавал только первую ошибку; Nest склеивает все через "; " — первая та же. */
export const CREATE_STORY_CASES: { body: unknown; out: object | string }[] = [
  { body: OK, out: OK },
  { body: { ...OK, openingBeat: "  Начало \n", premise: "  вводная " }, out: { ...OK, premise: "вводная" } },
  { body: { ...OK, premise: 5 }, out: OK },
  { body: { ...OK, extra: 1 }, out: OK },
  { body: { ...OK, bookId: "1" }, out: "bookId is required" },
  { body: { ...OK, openingBeat: "   " }, out: "openingBeat is required" },
  { body: { ...OK, openingBeat: 7 }, out: "openingBeat is required" },
  { body: { ...OK, templateId: null }, out: "templateId is required" },
  { body: { ...OK, presetId: undefined }, out: "presetId is required" },
  { body: {}, out: "bookId is required; openingBeat is required; templateId is required; presetId is required" },
];

const LONG = "я".repeat(150);

export const UPDATE_STORY_CASES: { body: unknown; out: object | string }[] = [
  { body: { title: "Новое" }, out: { title: "Новое" } },
  { body: { title: "" }, out: { title: "" } },
  { body: { title: LONG }, out: { title: "я".repeat(100) } },
  { body: { premise: "  Вводная  " }, out: { premise: "  Вводная  " } },
  { body: { premise: LONG }, out: { premise: LONG } },
  { body: { title: "Т", premise: "П" }, out: { title: "Т", premise: "П" } },
  { body: { title: 5, premise: "П" }, out: { premise: "П" } },
  { body: {}, out: "title or premise must be a string" },
  { body: { title: 5 }, out: "title or premise must be a string" },
  { body: { premise: null }, out: "title or premise must be a string" },
];

describe("CreateStoryDto", () => {
  it.each(CREATE_STORY_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body, CreateStoryDto)).toEqual(out);
  });
});

describe("UpdateStoryDto", () => {
  it.each(UPDATE_STORY_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body, UpdateStoryDto)).toEqual(out);
  });
});

describe("ListStoriesQueryDto", () => {
  it.each([
    { query: {}, out: { page: 1, pageSize: 20 } },
    { query: { page: "3", pageSize: "10" }, out: { page: 3, pageSize: 10 } },
    { query: { page: "0", pageSize: "500" }, out: { page: 1, pageSize: 50 } },
    { query: { page: "abc", pageSize: "-4" }, out: { page: 1, pageSize: 1 } },
    { query: { page: ["2", "5"] }, out: { page: 2, pageSize: 20 } },
  ])("$query → $out", async ({ query, out }) => {
    expect(await parse(query, ListStoriesQueryDto, "query")).toEqual(out);
  });
});
