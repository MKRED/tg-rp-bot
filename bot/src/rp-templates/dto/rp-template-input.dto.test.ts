import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { RpTemplateInputDto } = await import("./rp-template-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

/** Прогон тела через тот же ValidationPipe и тот же формат ошибки, что и в приложении. */
async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: RpTemplateInputDto });
    return { input: { ...dto } };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

const ids = ["system", "characterDescription", "characterScenario", "userDescription", "auxiliary", "history", "postHistory"];
const promptOrder = ids.map((id, i) => ({ id, enabled: i % 2 === 0 }));

// Явные значения у всех полей: drizzle .set() пропускает undefined, и PUT без поля оставил бы
// старое значение в БД — «нет поля» обязано превращаться в "" / true, а не в undefined.
const defaults = {
  systemPrompt: "",
  auxiliarySystemPrompt: "",
  postHistoryInstruction: "",
  userPersonaPrompt: "",
  userPersonaStreaming: true,
  translationSystemPrompt: "",
  promptOrder,
};

// Характеризация: ожидания сняты с прежнего ручного парсера Hono-версии (parseRpTemplateInput).
// В каждом ошибочном случае ровно одно плохое поле — «первая ошибка» и «склейка» совпадают.
const cases: { title: string; body: unknown; expected: Record<string, unknown> | string }[] = [
  { title: "минимальное тело — дефолты", body: { name: "T", promptOrder }, expected: { name: "T", ...defaults } },
  { title: "имя обрезается", body: { name: "  Шаблон  ", promptOrder }, expected: { name: "Шаблон" } },
  { title: "пустое имя", body: { name: "  ", promptOrder }, expected: "Name is required" },
  { title: "имени нет", body: { promptOrder }, expected: "Name is required" },
  { title: "имя не строка", body: { name: 5, promptOrder }, expected: "Name is required" },
  {
    title: "тексты как есть (без trim)",
    body: {
      name: "T",
      promptOrder,
      systemPrompt: " s ",
      auxiliarySystemPrompt: "a",
      postHistoryInstruction: "p",
      userPersonaPrompt: "u",
      translationSystemPrompt: "t",
    },
    expected: {
      systemPrompt: " s ",
      auxiliarySystemPrompt: "a",
      postHistoryInstruction: "p",
      userPersonaPrompt: "u",
      translationSystemPrompt: "t",
    },
  },
  {
    title: "тексты не строки → пусто",
    body: { name: "T", promptOrder, systemPrompt: 1, userPersonaPrompt: null, translationSystemPrompt: {} },
    expected: { systemPrompt: "", userPersonaPrompt: "", translationSystemPrompt: "" },
  },
  { title: "стриминг персоны false", body: { name: "T", promptOrder, userPersonaStreaming: false }, expected: { userPersonaStreaming: false } },
  { title: "стриминг персоны: не-false → true", body: { name: "T", promptOrder, userPersonaStreaming: 0 }, expected: { userPersonaStreaming: true } },
  { title: "стриминг персоны null → true", body: { name: "T", promptOrder, userPersonaStreaming: null }, expected: { userPersonaStreaming: true } },
  {
    title: "promptOrder: лишние ключи элементов отбрасываются",
    body: { name: "T", promptOrder: promptOrder.map((it) => ({ ...it, extra: 1 })) },
    expected: { promptOrder },
  },
  { title: "promptOrder нет", body: { name: "T" }, expected: "Invalid promptOrder" },
  { title: "promptOrder не массив", body: { name: "T", promptOrder: "x" }, expected: "Invalid promptOrder" },
  { title: "promptOrder короче", body: { name: "T", promptOrder: promptOrder.slice(1) }, expected: "Invalid promptOrder" },
  {
    title: "promptOrder длиннее",
    body: { name: "T", promptOrder: [...promptOrder, { id: "system", enabled: true }] },
    expected: "Invalid promptOrder",
  },
  {
    title: "promptOrder с дублем",
    body: { name: "T", promptOrder: [...promptOrder.slice(1), { id: "history", enabled: true }] },
    expected: "Invalid promptOrder",
  },
  {
    title: "promptOrder с неизвестным id",
    body: { name: "T", promptOrder: [...promptOrder.slice(1), { id: "lorebook", enabled: true }] },
    expected: "Invalid promptOrder",
  },
  {
    title: "promptOrder: enabled не boolean",
    body: { name: "T", promptOrder: [{ id: "system", enabled: 1 }, ...promptOrder.slice(1)] },
    expected: "Invalid promptOrder",
  },
  {
    title: "promptOrder: элемент не объект",
    body: { name: "T", promptOrder: [null, ...promptOrder.slice(1)] },
    expected: "Invalid promptOrder",
  },
];

describe("RpTemplateInputDto + ValidationPipe", () => {
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
    const result = await viaDto({ name: "T", promptOrder });
    expect(result).toStrictEqual({ input: { name: "T", ...defaults } });
  });

  it("лишние поля отсекаются", async () => {
    const result = await viaDto({ name: "T", promptOrder, userId: 1, id: 5, extra: "x" });
    expect(result).toStrictEqual({ input: { name: "T", ...defaults } });
  });

  it("promptOrder: элементы — ровно { id, enabled }", async () => {
    const result = await viaDto({ name: "T", promptOrder: promptOrder.map((it) => ({ ...it, extra: 1 })) });
    expect((result as { input: { promptOrder: unknown } }).input.promptOrder).toStrictEqual(promptOrder);
  });
});
