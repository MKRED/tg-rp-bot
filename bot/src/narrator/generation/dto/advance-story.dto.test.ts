import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { AdvanceStoryDto } from "./advance-story.dto.js";

/** Характеризационная таблица: тело advance → директива (пусто = «Дальше»), как у Hono; 400 не бывает. */
const pipe = createValidationPipe();
const parse = async (body: unknown) => ({ ...((await pipe.transform(body, { type: "body", metatype: AdvanceStoryDto })) as object) });

describe("AdvanceStoryDto", () => {
  it.each([
    { body: { directive: "  рыцарь входит " }, out: { directive: "рыцарь входит" } },
    { body: { directive: "   " }, out: { directive: "" } },
    { body: { directive: 5 }, out: { directive: "" } },
    { body: { directive: null }, out: { directive: "" } },
    { body: {}, out: { directive: "" } },
  ])("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
