import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { LlmDebugSettingsPatchDto } from "./llm-debug-settings-patch.dto.js";

/**
 * Характеризационная таблица: тело запроса → патч, как его разбирал Hono-контроллер. Поле не того
 * типа не даёт 400, а выпадает из патча; числа не клампятся здесь (это делает репозиторий).
 */
const pipe = createValidationPipe();
async function parse(body: unknown): Promise<Record<string, unknown>> {
  const dto = (await pipe.transform(body, { type: "body", metatype: LlmDebugSettingsPatchDto })) as object;
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
}

describe("LlmDebugSettingsPatchDto", () => {
  it.each([
    { body: {}, patch: {} },
    { body: { enabled: false }, patch: { enabled: false } },
    { body: { enabled: true }, patch: { enabled: true } },
    { body: { enabled: "false" }, patch: {} },
    { body: { enabled: 0 }, patch: {} },
    { body: { maxRequests: 50 }, patch: { maxRequests: 50 } },
    { body: { maxRequests: 999 }, patch: { maxRequests: 999 } },
    { body: { maxRequests: -1.5 }, patch: { maxRequests: -1.5 } },
    { body: { maxRequests: Infinity }, patch: { maxRequests: Infinity } },
    { body: { maxRequests: "50" }, patch: {} },
    { body: { headMessages: 0, tailMessages: 10 }, patch: { headMessages: 0, tailMessages: 10 } },
    { body: { headMessages: null, tailMessages: "3" }, patch: {} },
    { body: { enabled: true, extra: 1 }, patch: { enabled: true } },
  ])("$body → $patch", async ({ body, patch }) => {
    expect(await parse(body)).toEqual(patch);
  });
});
