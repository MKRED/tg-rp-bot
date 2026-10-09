import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { PresetInputDto } = await import("./preset-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

/** Прогон тела через тот же ValidationPipe и тот же формат ошибки, что и в приложении. */
async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: PresetInputDto });
    return { input: { ...dto } };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

// Явные null/false у всех полей: drizzle .set() пропускает undefined, и PUT без поля оставил бы
// старое значение в БД — поэтому «нет поля» обязано превращаться в null/false, а не в undefined.
const defaults = {
  contextUnlimited: false,
  contextSize: null,
  maxTokens: null,
  streaming: false,
  temperature: null,
  topP: null,
  topK: null,
  frequencyPenalty: null,
  presencePenalty: null,
  repetitionPenalty: null,
  minP: null,
  topA: null,
  requestReasoning: false,
  reasoningEffort: null,
};

// Характеризация: ожидания сняты с прежнего ручного парсера Hono-версии (parsePresetInput).
// В каждом ошибочном случае ровно одно плохое поле — «первая ошибка» и «склейка» совпадают.
const cases: { title: string; body: unknown; expected: Record<string, unknown> | string }[] = [
  { title: "минимальное тело — дефолты", body: { name: "P" }, expected: { name: "P", ...defaults } },
  { title: "имя обрезается", body: { name: "  Быстрый  " }, expected: { name: "Быстрый" } },
  { title: "пустое имя", body: { name: "  " }, expected: "Name is required" },
  { title: "имени нет", body: {}, expected: "Name is required" },
  { title: "имя не строка", body: { name: 5 }, expected: "Name is required" },
  {
    title: "булевы true",
    body: { name: "P", contextUnlimited: true, streaming: true, requestReasoning: true },
    expected: { contextUnlimited: true, streaming: true, requestReasoning: true },
  },
  {
    title: "булевы: не-true → false",
    body: { name: "P", contextUnlimited: "true", streaming: 1, requestReasoning: null },
    expected: { contextUnlimited: false, streaming: false, requestReasoning: false },
  },
  {
    title: "лимиты токенов",
    body: { name: "P", contextSize: 32000, maxTokens: 1 },
    expected: { contextSize: 32000, maxTokens: 1 },
  },
  { title: "contextSize null", body: { name: "P", contextSize: null }, expected: { contextSize: null } },
  { title: "contextSize 0", body: { name: "P", contextSize: 0 }, expected: "contextSize must be a positive integer or null" },
  { title: "contextSize дробный", body: { name: "P", contextSize: 1.5 }, expected: "contextSize must be a positive integer or null" },
  { title: "contextSize строка", body: { name: "P", contextSize: "5" }, expected: "contextSize must be a positive integer or null" },
  { title: "maxTokens отрицательный", body: { name: "P", maxTokens: -1 }, expected: "maxTokens must be a positive integer or null" },
  {
    title: "сэмплинг на границах",
    body: {
      name: "P",
      temperature: 2,
      topP: 0,
      topK: 1000,
      frequencyPenalty: -2,
      presencePenalty: 2,
      repetitionPenalty: 0,
      minP: 1,
      topA: 0.5,
    },
    expected: {
      temperature: 2,
      topP: 0,
      topK: 1000,
      frequencyPenalty: -2,
      presencePenalty: 2,
      repetitionPenalty: 0,
      minP: 1,
      topA: 0.5,
    },
  },
  { title: "сэмплинг null", body: { name: "P", temperature: null }, expected: { temperature: null } },
  { title: "temperature > 2", body: { name: "P", temperature: 2.01 }, expected: "Invalid value for temperature" },
  { title: "temperature < 0", body: { name: "P", temperature: -0.1 }, expected: "Invalid value for temperature" },
  { title: "topP > 1", body: { name: "P", topP: 1.1 }, expected: "Invalid value for topP" },
  { title: "topK дробный", body: { name: "P", topK: 1.5 }, expected: "Invalid value for topK" },
  { title: "topK < 0", body: { name: "P", topK: -1 }, expected: "Invalid value for topK" },
  { title: "frequencyPenalty < -2", body: { name: "P", frequencyPenalty: -2.5 }, expected: "Invalid value for frequencyPenalty" },
  { title: "presencePenalty > 2", body: { name: "P", presencePenalty: 3 }, expected: "Invalid value for presencePenalty" },
  { title: "repetitionPenalty > 2", body: { name: "P", repetitionPenalty: 2.5 }, expected: "Invalid value for repetitionPenalty" },
  { title: "minP < 0", body: { name: "P", minP: -0.01 }, expected: "Invalid value for minP" },
  { title: "topA > 1", body: { name: "P", topA: 1.01 }, expected: "Invalid value for topA" },
  { title: "сэмплинг строкой", body: { name: "P", temperature: "1" }, expected: "Invalid value for temperature" },
  { title: "reasoningEffort из списка", body: { name: "P", reasoningEffort: "xhigh" }, expected: { reasoningEffort: "xhigh" } },
  { title: "reasoningEffort null", body: { name: "P", reasoningEffort: null }, expected: { reasoningEffort: null } },
  { title: "reasoningEffort неизвестный", body: { name: "P", reasoningEffort: "huge" }, expected: "Invalid reasoningEffort" },
  { title: "reasoningEffort не строка", body: { name: "P", reasoningEffort: 3 }, expected: "Invalid reasoningEffort" },
];

describe("PresetInputDto + ValidationPipe", () => {
  it.each(cases)("$title", async ({ body, expected }) => {
    const result = await viaDto(body);
    if (typeof expected === "string") {
      expect(result).toEqual({ error: expected });
    } else {
      expect(result).toHaveProperty("input");
      expect((result as { input: Record<string, unknown> }).input).toMatchObject(expected);
    }
  });

  it("минимальное тело — ровно поля контракта, без undefined", async () => {
    const result = await viaDto({ name: "P" });
    expect(result).toStrictEqual({ input: { name: "P", ...defaults } });
  });

  it("лишние поля отсекаются", async () => {
    const result = await viaDto({ name: "P", userId: 1, id: 5, extra: "x" });
    expect(result).toStrictEqual({ input: { name: "P", ...defaults } });
  });
});
