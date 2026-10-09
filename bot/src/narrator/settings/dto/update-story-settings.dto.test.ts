import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { UpdateStorySettingsDto } from "./update-story-settings.dto.js";

/**
 * Характеризационная таблица: тело PUT /api/stories/:id/settings → патч (только корректные поля),
 * как у Hono. compactFloorTokens здесь — сырое целое (кламп по пресету — в сервисе).
 */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object> {
  const dto = (await pipe.transform(body, { type: "body", metatype: UpdateStorySettingsDto })) as object;
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
}

const BOOLS = { compactEnabled: true, compactAutoEnabled: false, quickRollbackEnabled: true, editEnabled: false };

export const UPDATE_STORY_SETTINGS_CASES: { body: unknown; out: object }[] = [
  { body: {}, out: {} },
  { body: { translateEnabled: true, translateTargetLang: "en", translateScope: "user", autoTranslateScope: "all", translateMethod: "ai" },
    out: { translateEnabled: true, translateTargetLang: "en", translateScope: "user", autoTranslateScope: "all", translateMethod: "ai" } },
  { body: { translateScope: "none", autoTranslateScope: "x", translateMethod: "deepl", translateEnabled: 1 }, out: {} },
  { body: BOOLS, out: BOOLS },
  { body: { compactEnabled: "true", editEnabled: null }, out: {} },
  { body: { compactWords: 333.6 }, out: { compactWords: 334 } },
  { body: { compactWords: 10 }, out: { compactWords: 50 } },
  { body: { compactWords: 5000 }, out: { compactWords: 800 } },
  { body: { compactWords: "200" }, out: {} },
  { body: { compactWords: null }, out: {} },
  { body: { compactFloorTokens: 1234.4 }, out: { compactFloorTokens: 1234 } },
  { body: { compactFloorTokens: -50 }, out: { compactFloorTokens: -50 } },
  { body: { compactFloorTokens: "1000" }, out: {} },
  { body: { extra: 1, compactAutoEnabled: true }, out: { compactAutoEnabled: true } },
];

describe("UpdateStorySettingsDto", () => {
  it.each(UPDATE_STORY_SETTINGS_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(out);
  });
});
