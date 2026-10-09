import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { GenerateCardBlockDto } = await import("./generate-card-block.dto.js");
const { AnswerCardQuestionsDto } = await import("./answer-card-questions.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

async function via(metatype: new () => object, body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype });
    return { input: JSON.parse(JSON.stringify(dto)) as Record<string, unknown> };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

// Характеризация разбора тел в обработчиках Hono-версии (cards.controller.ts).
describe("GenerateCardBlockDto", () => {
  it.each([
    { title: "пустое тело — следующий блок", body: {}, expected: {} },
    { title: "categoryId строка", body: { categoryId: "body" }, expected: { categoryId: "body" } },
    { title: "пустая строка — тоже явный блок", body: { categoryId: "" }, expected: { categoryId: "" } },
    { title: "не-строка — как отсутствие, не ошибка", body: { categoryId: 5 }, expected: {} },
    { title: "лишние поля отсекаются", body: { categoryId: "a", x: 1 }, expected: { categoryId: "a" } },
  ])("$title", async ({ body, expected }) => {
    expect(await via(GenerateCardBlockDto, body)).toStrictEqual({ input: expected });
  });
});

describe("AnswerCardQuestionsDto", () => {
  it.each([
    { title: "ответы", body: { categoryId: "a", answers: ["x", "y"] }, expected: { categoryId: "a", skipped: false, answers: ["x", "y"] } },
    { title: "пустой массив ответов — допустим", body: { categoryId: "a", answers: [] }, expected: { categoryId: "a", skipped: false, answers: [] } },
    { title: "skipped: answers не нужны", body: { categoryId: "a", skipped: true }, expected: { categoryId: "a", skipped: true } },
    { title: "skipped: мусорные answers не мешают", body: { categoryId: "a", skipped: true, answers: 1 }, expected: { categoryId: "a", skipped: true, answers: 1 } },
    { title: "categoryId не обрезается", body: { categoryId: " a ", answers: [] }, expected: { categoryId: " a ", skipped: false, answers: [] } },
  ])("$title", async ({ body, expected }) => {
    expect(await via(AnswerCardQuestionsDto, body)).toStrictEqual({ input: expected });
  });

  it.each([
    { title: "categoryId нет", body: { answers: [] }, expected: "categoryId is required" },
    { title: "categoryId пустой", body: { categoryId: "", answers: [] }, expected: "categoryId is required" },
    { title: "categoryId не строка", body: { categoryId: 1, answers: [] }, expected: "categoryId is required" },
    { title: "answers нет", body: { categoryId: "a" }, expected: "answers must be a string array" },
    { title: "answers не массив", body: { categoryId: "a", answers: "x" }, expected: "answers must be a string array" },
    { title: "answers не строки", body: { categoryId: "a", answers: ["x", 1] }, expected: "answers must be a string array" },
    { title: "skipped не true — answers обязательны", body: { categoryId: "a", skipped: "yes" }, expected: "answers must be a string array" },
  ])("$title", async ({ body, expected }) => {
    expect(await via(AnswerCardQuestionsDto, body)).toEqual({ error: expected });
  });
});
