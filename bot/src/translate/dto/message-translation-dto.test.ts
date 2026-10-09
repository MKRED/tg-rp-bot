import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { MessageTranslateTextDto } from "./message-translate-text.dto.js";
import { DeleteTranslationQueryDto } from "./delete-translation-query.dto.js";
import { TranslateMessageDto } from "./translate-message.dto.js";

/** Характеризационные таблицы DTO перевода сообщений (RP-чат и истории): вход → поля или текст 400, как у Hono. */
const pipe = createValidationPipe();
async function parse(value: unknown, metatype: new () => object, type: "body" | "query" = "body"): Promise<object | string> {
  try {
    return { ...((await pipe.transform(value, { type, metatype })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

export const TRANSLATE_MESSAGE_CASES: { body: unknown; out: object | string }[] = [
  { body: { targetLang: "en" }, out: { targetLang: "en", force: false } },
  { body: { targetLang: " en ", force: true }, out: { targetLang: "en", force: true } },
  { body: { targetLang: "en", force: "true" }, out: { targetLang: "en", force: false } },
  { body: { targetLang: "en", force: 1 }, out: { targetLang: "en", force: false } },
  { body: {}, out: "targetLang is required" },
  { body: { targetLang: "   " }, out: "targetLang is required" },
  { body: { targetLang: 5, force: true }, out: "targetLang is required" },
];

export const DELETE_TRANSLATION_CASES: { query: unknown; out: object | string }[] = [
  { query: { lang: "en" }, out: { lang: "en" } },
  { query: { lang: " ru " }, out: { lang: "ru" } },
  { query: { lang: ["de", "en"] }, out: { lang: "de" } },
  { query: {}, out: "lang is required" },
  { query: { lang: "" }, out: "lang is required" },
  { query: { lang: "  " }, out: "lang is required" },
];

const REQUIRED = "text and targetLang are required";
export const TRANSLATE_TEXT_CASES: { body: unknown; out: object | string }[] = [
  { body: { text: "Привет", targetLang: "en" }, out: { text: "Привет", targetLang: "en", mode: "google" } },
  { body: { text: " a\n\nb ", targetLang: " en ", mode: "ai" }, out: { text: " a\n\nb ", targetLang: "en", mode: "ai" } },
  { body: { text: "a", targetLang: "en", mode: "AI" }, out: { text: "a", targetLang: "en", mode: "google" } },
  { body: { text: "a", targetLang: "en", mode: 1 }, out: { text: "a", targetLang: "en", mode: "google" } },
  { body: {}, out: REQUIRED },
  { body: { text: "  ", targetLang: "en" }, out: REQUIRED },
  { body: { text: "a", targetLang: " " }, out: REQUIRED },
  { body: { text: 5, targetLang: "en" }, out: REQUIRED },
  { body: { text: "a" }, out: REQUIRED },
];

describe("TranslateMessageDto", () => {
  it.each(TRANSLATE_MESSAGE_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body, TranslateMessageDto)).toEqual(out);
  });
});

describe("DeleteTranslationQueryDto", () => {
  it.each(DELETE_TRANSLATION_CASES)("$query → $out", async ({ query, out }) => {
    expect(await parse(query, DeleteTranslationQueryDto, "query")).toEqual(out);
  });
});

describe("MessageTranslateTextDto", () => {
  it.each(TRANSLATE_TEXT_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body, MessageTranslateTextDto)).toEqual(out);
  });
});
