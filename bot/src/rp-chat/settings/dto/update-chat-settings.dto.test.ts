import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../../common/validation-pipe.js";
import { UpdateChatSettingsDto } from "./update-chat-settings.dto.js";

/**
 * Характеризационная таблица: тело PUT /api/chats/:id/settings → патч (только корректные поля),
 * как у Hono. Невалидное поле не даёт 400 — оно просто не попадает в патч.
 */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<object> {
  const dto = (await pipe.transform(body, { type: "body", metatype: UpdateChatSettingsDto })) as object;
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
}

const FULL = {
  translateEnabled: true,
  translateTargetLang: "en",
  translateScope: "all",
  autoTranslateScope: "user",
  translateMethod: "ai",
};

export const UPDATE_SETTINGS_CASES: { body: unknown; out: object }[] = [
  { body: FULL, out: FULL },
  { body: {}, out: {} },
  { body: { translateEnabled: false }, out: { translateEnabled: false } },
  { body: { translateEnabled: "true" }, out: {} },
  { body: { translateTargetLang: "" }, out: { translateTargetLang: "" } },
  { body: { translateTargetLang: 5 }, out: {} },
  { body: { translateScope: "none" }, out: {} },
  { body: { translateScope: "assistant", autoTranslateScope: "none" }, out: { translateScope: "assistant", autoTranslateScope: "none" } },
  { body: { autoTranslateScope: "ALL" }, out: {} },
  { body: { translateMethod: "google" }, out: { translateMethod: "google" } },
  { body: { translateMethod: "deepl" }, out: {} },
  { body: { ...FULL, translateScope: 1, extra: "x" }, out: { ...FULL, translateScope: undefined } },
];

describe("UpdateChatSettingsDto", () => {
  it.each(UPDATE_SETTINGS_CASES)("$body → $out", async ({ body, out }) => {
    expect(await parse(body)).toEqual(JSON.parse(JSON.stringify(out)));
  });
});
