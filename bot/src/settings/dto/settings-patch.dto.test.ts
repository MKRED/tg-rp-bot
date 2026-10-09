import type { ArgumentMetadata } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../../common/validation-pipe.js";
import { LlmSettingsPatchDto, TavilySettingsPatchDto, TranslateSettingsPatchDto, VerifyKeyDto } from "./settings-patch.dto.js";

/**
 * Характеризационные таблицы: тело запроса → патч, как его разбирали Hono-контроллеры. Невалидное
 * поле не даёт 400, а выпадает из патча (undefined — «не трогать»); null у apiKey/promptTemplate
 * сохраняется (удалить/сбросить).
 */
const pipe = createValidationPipe();
async function parse(metatype: ArgumentMetadata["metatype"], body: unknown): Promise<Record<string, unknown>> {
  const dto = (await pipe.transform(body, { type: "body", metatype })) as object;
  // Поля со значением undefined = «не трогать» — сравниваем только реально пришедшие в патч.
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
}

describe("LlmSettingsPatchDto", () => {
  it.each([
    { body: {}, patch: {} },
    { body: { model: "deepseek-chat" }, patch: { model: "deepseek-chat" } },
    { body: { model: "  m  " }, patch: { model: "m" } },
    { body: { model: "   " }, patch: {} },
    { body: { model: 123 }, patch: {} },
    { body: { apiKey: null }, patch: { apiKey: null } },
    { body: { apiKey: "  sk-1  " }, patch: { apiKey: "sk-1" } },
    // Пустая строка остаётся строкой — её отклонит проверка формата в сервисе (400), как раньше.
    { body: { apiKey: "" }, patch: { apiKey: "" } },
    { body: { apiKey: 42 }, patch: {} },
    { body: { apiKey: null, model: "m" }, patch: { apiKey: null, model: "m" } },
    { body: { extra: 1, model: "m" }, patch: { model: "m" } },
  ])("$body → $patch", async ({ body, patch }) => {
    expect(await parse(LlmSettingsPatchDto, body)).toEqual(patch);
  });
});

describe("TavilySettingsPatchDto", () => {
  it.each([
    { body: {}, patch: {} },
    { body: { maxSearchRounds: 5 }, patch: { maxSearchRounds: 5 } },
    { body: { maxSearchRounds: 4.5 }, patch: { maxSearchRounds: 4.5 } },
    { body: { maxSearchRounds: -3 }, patch: { maxSearchRounds: -3 } },
    { body: { maxSearchRounds: Infinity }, patch: { maxSearchRounds: Infinity } },
    { body: { maxSearchRounds: "5" }, patch: {} },
    { body: { maxSearchRounds: null }, patch: {} },
    { body: { apiKey: null }, patch: { apiKey: null } },
    { body: { apiKey: " tvly-1 " }, patch: { apiKey: "tvly-1" } },
    { body: { apiKey: true, maxSearchRounds: 2 }, patch: { maxSearchRounds: 2 } },
  ])("$body → $patch", async ({ body, patch }) => {
    expect(await parse(TavilySettingsPatchDto, body)).toEqual(patch);
  });
});

describe("TranslateSettingsPatchDto", () => {
  it.each([
    { body: {}, patch: {} },
    { body: { engine: "ai" }, patch: { engine: "ai" } },
    { body: { engine: "google" }, patch: { engine: "google" } },
    { body: { engine: "deepl" }, patch: {} },
    { body: { targetLang: " ru " }, patch: { targetLang: "ru" } },
    { body: { targetLang: "  " }, patch: {} },
    { body: { targetLang: 7 }, patch: {} },
    { body: { promptTemplate: null }, patch: { promptTemplate: null } },
    { body: { promptTemplate: "  Переведи {{target_lang}}\n" }, patch: { promptTemplate: "  Переведи {{target_lang}}\n" } },
    { body: { promptTemplate: "" }, patch: { promptTemplate: "" } },
    { body: { promptTemplate: 1 }, patch: {} },
    { body: { reasoningEffort: "off" }, patch: { reasoningEffort: "off" } },
    { body: { reasoningEffort: "high" }, patch: { reasoningEffort: "high" } },
    { body: { reasoningEffort: "extreme" }, patch: {} },
    { body: { reasoningEffort: null }, patch: {} },
  ])("$body → $patch", async ({ body, patch }) => {
    expect(await parse(TranslateSettingsPatchDto, body)).toEqual(patch);
  });
});

describe("VerifyKeyDto", () => {
  it.each([
    { body: {}, apiKey: "" },
    { body: { apiKey: " sk-1 " }, apiKey: "sk-1" },
    { body: { apiKey: "   " }, apiKey: "" },
    { body: { apiKey: 5 }, apiKey: "" },
    { body: { apiKey: null }, apiKey: "" },
  ])("$body → apiKey $apiKey", async ({ body, apiKey }) => {
    expect(await parse(VerifyKeyDto, body)).toEqual({ apiKey });
  });
});
