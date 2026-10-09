import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { CreateChatDto } from "./create-chat.dto.js";

/** Характеризационная таблица: тело POST /api/chats → поля или текст 400 (первый — как у Hono). */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object | string> {
  try {
    return { ...((await pipe.transform(body, { type: "body", metatype: CreateChatDto })) as object) };
  } catch (err) {
    const res = (err as { getResponse(): { message: string[] } }).getResponse();
    return [...new Set(res.message)].join("; ");
  }
}

const IDS = { characterId: 1, personaId: 2, templateId: 3, presetId: 4 };

export const CREATE_CHAT_CASES: { body: unknown; out: object | string }[] = [
  { body: { ...IDS, firstMessageIndex: 2 }, out: { ...IDS, firstMessageIndex: 2 } },
  { body: IDS, out: { ...IDS, firstMessageIndex: 0 } },
  { body: { ...IDS, firstMessageIndex: "1" }, out: { ...IDS, firstMessageIndex: 0 } },
  { body: { ...IDS, firstMessageIndex: null }, out: { ...IDS, firstMessageIndex: 0 } },
  { body: { ...IDS, firstMessageIndex: -1 }, out: { ...IDS, firstMessageIndex: -1 } },
  { body: { ...IDS, firstMessageIndex: 1.5 }, out: { ...IDS, firstMessageIndex: 1.5 } },
  { body: { ...IDS, extra: true }, out: { ...IDS, firstMessageIndex: 0 } },
  { body: { ...IDS, characterId: 0 }, out: { ...IDS, characterId: 0, firstMessageIndex: 0 } },
  { body: {}, out: "characterId is required; personaId is required; templateId is required; presetId is required" },
  { body: { ...IDS, characterId: "1" }, out: "characterId is required" },
  { body: { ...IDS, characterId: null }, out: "characterId is required" },
  { body: { ...IDS, personaId: undefined }, out: "personaId is required" },
  { body: { ...IDS, templateId: "3" }, out: "templateId is required" },
  { body: { ...IDS, presetId: [4] }, out: "presetId is required" },
  { body: { characterId: 1, templateId: 3 }, out: "personaId is required; presetId is required" },
];

describe("CreateChatDto", () => {
  it.each(CREATE_CHAT_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
