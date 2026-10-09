import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { CardInputDto } = await import("./card-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

/** Прогон тела через тот же ValidationPipe и тот же формат ошибки, что и в приложении. */
async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: CardInputDto });
    return { input: JSON.parse(JSON.stringify(dto)) as Record<string, unknown> };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

const cat = (over: Record<string, unknown> = {}) => ({
  id: "base",
  title: "Base",
  description: "Name: ...",
  content: "",
  enabled: true,
  ...over,
});
const base = { name: "N", categories: [] };

// Явные значения у всех полей: drizzle .set() пропускает undefined, и PUT без поля оставил бы
// старое значение в БД — «нет поля» обязано превращаться в ""/false/null, а не в undefined.
const defaults = {
  name: "N",
  systemPrompt: "",
  prompt: "",
  categories: [],
  presetId: null,
  useWebSearch: false,
  useAskUser: false,
};

// Характеризация: ожидания сняты с прежнего ручного парсера Hono-версии (parseCardInput).
// В каждом ошибочном случае ровно одно плохое поле — «первая ошибка» и «склейка» совпадают.
const cases: { title: string; body: unknown; expected: Record<string, unknown> | string }[] = [
  { title: "минимальное тело — дефолты", body: base, expected: defaults },
  { title: "имя обрезается", body: { ...base, name: "  Артур  " }, expected: { name: "Артур" } },
  { title: "длинное имя не усекается", body: { ...base, name: "x".repeat(300) }, expected: { name: "x".repeat(300) } },
  { title: "пустое имя", body: { ...base, name: "  " }, expected: "Name is required" },
  { title: "имени нет", body: { categories: [] }, expected: "Name is required" },
  { title: "имя не строка", body: { ...base, name: 5 }, expected: "Name is required" },
  {
    title: "промпты как есть, не-строки → пусто",
    body: { ...base, systemPrompt: " s ", prompt: 7 },
    expected: { systemPrompt: " s ", prompt: "" },
  },
  { title: "categories нет", body: { name: "N" }, expected: "categories must be an array" },
  { title: "categories не массив", body: { ...base, categories: "x" }, expected: "categories must be an array" },
  { title: "categories null", body: { ...base, categories: null }, expected: "categories must be an array" },
  {
    title: "категорий больше 30",
    body: { ...base, categories: Array.from({ length: 31 }, (_, i) => cat({ id: `c${i}` })) },
    expected: "Too many categories (max 30)",
  },
  {
    title: "ровно 30 категорий — можно",
    body: { ...base, categories: Array.from({ length: 30 }, (_, i) => cat({ id: `c${i}` })) },
    expected: { name: "N" },
  },
  {
    title: "лимит проверяется раньше содержимого",
    body: { ...base, categories: Array.from({ length: 31 }, () => null) },
    expected: "Too many categories (max 30)",
  },
  {
    title: "категория: id/title/description обрезаются, content как есть",
    body: { ...base, categories: [cat({ id: " a ", title: " T ", description: " D ", content: " C ", enabled: false })] },
    expected: { categories: [{ id: "a", title: "T", description: "D", content: " C ", enabled: false }] },
  },
  { title: "категория не объект", body: { ...base, categories: [cat(), "x"] }, expected: "Category 1 must be an object" },
  { title: "категория null", body: { ...base, categories: [null] }, expected: "Category 0 must be an object" },
  { title: "id пустой", body: { ...base, categories: [cat({ id: "  " })] }, expected: "Category 0: id is required" },
  { title: "id не строка", body: { ...base, categories: [cat({ id: 1 })] }, expected: "Category 0: id is required" },
  { title: "title не строка", body: { ...base, categories: [cat({ title: null })] }, expected: "Category 0: title must be a string" },
  {
    title: "description нет",
    body: { ...base, categories: [{ id: "a", title: "T", content: "", enabled: true }] },
    expected: "Category 0: description must be a string",
  },
  { title: "content не строка", body: { ...base, categories: [cat({ content: 1 })] }, expected: "Category 0: content must be a string" },
  { title: "enabled не boolean", body: { ...base, categories: [cat({ enabled: "true" })] }, expected: "Category 0: enabled must be a boolean" },
  {
    title: "первая ошибка — по порядку полей",
    body: { ...base, categories: [cat({ id: "", title: 1, enabled: 1 })] },
    expected: "Category 0: id is required",
  },
  {
    title: "дубль id (после обрезки)",
    body: { ...base, categories: [cat({ id: "a" }), cat({ id: "b" }), cat({ id: " a " })] },
    expected: "Category 2: duplicate id",
  },
  {
    title: "ошибка раньше дубля — побеждает ошибка",
    body: { ...base, categories: [cat({ id: "a" }), cat({ id: "a", enabled: 0 })] },
    expected: "Category 1: enabled must be a boolean",
  },
  { title: "presetId число", body: { ...base, presetId: 7 }, expected: { presetId: 7 } },
  { title: "presetId null", body: { ...base, presetId: null }, expected: { presetId: null } },
  { title: "presetId дробный", body: { ...base, presetId: 1.5 }, expected: "presetId must be an integer" },
  { title: "presetId строка", body: { ...base, presetId: "7" }, expected: "presetId must be an integer" },
  {
    title: "флаги true",
    body: { ...base, useWebSearch: true, useAskUser: true },
    expected: { useWebSearch: true, useAskUser: true },
  },
  {
    title: "флаги: не-boolean → false",
    body: { ...base, useWebSearch: "true", useAskUser: 1 },
    expected: { useWebSearch: false, useAskUser: false },
  },
];

describe("CardInputDto + ValidationPipe", () => {
  it.each(cases)("$title", async ({ body, expected }) => {
    const result = await viaDto(body);
    if (typeof expected === "string") {
      expect(result).toEqual({ error: expected });
    } else {
      expect(result).toHaveProperty("input");
      expect((result as { input: Record<string, unknown> }).input).toMatchObject(expected);
    }
  });

  it("минимальное тело — ровно поля контракта", async () => {
    expect(await viaDto(base)).toStrictEqual({ input: defaults });
  });

  it("лишние поля отсекаются, ask_user-состояние категорий — тоже (оно сервер-владеемое)", async () => {
    const category = {
      ...cat(),
      extra: 1,
      pendingQuestions: [{ question: "Q?" }],
      askUserAnswers: [{ question: "Q?", answer: "A" }],
    };
    expect(await viaDto({ ...base, categories: [category], userId: 1, id: 5 })).toStrictEqual({
      input: { ...defaults, categories: [cat()] },
    });
  });
});
