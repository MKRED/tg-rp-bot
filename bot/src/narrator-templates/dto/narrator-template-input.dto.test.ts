import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { NarratorTemplateInputDto } = await import("./narrator-template-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

/** Прогон тела через тот же ValidationPipe и тот же формат ошибки, что и в приложении. */
async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: NarratorTemplateInputDto });
    return { input: { ...dto } };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

const defaultOrder = [
  { id: "system", enabled: true },
  { id: "lorebook", enabled: true },
  { id: "auxiliary", enabled: true },
  { id: "premise", enabled: true },
  { id: "compact", enabled: true },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: false },
];
const markers = { continueMarker: "Continue.", leadingUserMarker: "Begin." };
const base = { name: "N", ...markers };

// Явные значения у всех полей: drizzle .set() пропускает undefined, и PUT без поля оставил бы
// старое значение в БД — «нет поля» обязано превращаться в ""/false/дефолт, а не в undefined.
const defaults = {
  systemPrompt: "",
  auxiliarySystemPrompt: "",
  postHistoryInstruction: "",
  translationSystemPrompt: "",
  compactionPrompt: "",
  ...markers,
  promptOrder: defaultOrder,
  mergeSystemPrompts: false,
  translationReasoningEffort: "medium",
  translatePerParagraph: false,
};

// Характеризация: ожидания сняты с прежнего ручного парсера Hono-версии (parseNarratorTemplateInput).
// В каждом ошибочном случае ровно одно плохое поле — «первая ошибка» и «склейка» совпадают.
const cases: { title: string; body: unknown; expected: Record<string, unknown> | string }[] = [
  { title: "минимальное тело — дефолты", body: base, expected: { name: "N", ...defaults } },
  { title: "имя обрезается", body: { ...base, name: "  Рассказчик  " }, expected: { name: "Рассказчик" } },
  { title: "имя длиннее 100 — усекается", body: { ...base, name: "x".repeat(150) }, expected: { name: "x".repeat(100) } },
  { title: "пустое имя", body: { ...base, name: " " }, expected: "Name is required" },
  { title: "имени нет", body: markers, expected: "Name is required" },
  { title: "имя не строка", body: { ...base, name: 1 }, expected: "Name is required" },
  {
    title: "тексты как есть, не-строки → пусто",
    body: { ...base, systemPrompt: " s ", compactionPrompt: "c", auxiliarySystemPrompt: 5, translationSystemPrompt: null },
    expected: { systemPrompt: " s ", compactionPrompt: "c", auxiliarySystemPrompt: "", translationSystemPrompt: "" },
  },
  { title: "маркеры обрезаются", body: { ...base, continueMarker: "  Go.  ", leadingUserMarker: " Start. " }, expected: { continueMarker: "Go.", leadingUserMarker: "Start." } },
  { title: "continueMarker пустой", body: { ...base, continueMarker: "  " }, expected: "Continue marker is required" },
  { title: "continueMarker нет", body: { name: "N", leadingUserMarker: "B" }, expected: "Continue marker is required" },
  { title: "continueMarker не строка", body: { ...base, continueMarker: 1 }, expected: "Continue marker is required" },
  { title: "leadingUserMarker пустой", body: { ...base, leadingUserMarker: "" }, expected: "Leading user marker is required" },
  { title: "leadingUserMarker нет", body: { name: "N", continueMarker: "C" }, expected: "Leading user marker is required" },
  {
    title: "флаги true",
    body: { ...base, mergeSystemPrompts: true, translatePerParagraph: true },
    expected: { mergeSystemPrompts: true, translatePerParagraph: true },
  },
  {
    title: "флаги: не-true → false",
    body: { ...base, mergeSystemPrompts: "true", translatePerParagraph: 1 },
    expected: { mergeSystemPrompts: false, translatePerParagraph: false },
  },
  { title: "translationReasoningEffort off", body: { ...base, translationReasoningEffort: "off" }, expected: { translationReasoningEffort: "off" } },
  { title: "translationReasoningEffort ultra", body: { ...base, translationReasoningEffort: "ultra" }, expected: { translationReasoningEffort: "ultra" } },
  { title: "translationReasoningEffort неизвестный", body: { ...base, translationReasoningEffort: "huge" }, expected: "Invalid translationReasoningEffort" },
  { title: "translationReasoningEffort null", body: { ...base, translationReasoningEffort: null }, expected: "Invalid translationReasoningEffort" },
  {
    title: "promptOrder свой порядок сохраняется",
    body: { ...base, promptOrder: [...defaultOrder].reverse() },
    expected: { promptOrder: [...defaultOrder].reverse() },
  },
  {
    title: "promptOrder старый (без compact) — compact дописывается на дефолтное место",
    body: { ...base, promptOrder: defaultOrder.filter((i) => i.id !== "compact") },
    expected: { promptOrder: defaultOrder },
  },
  {
    title: "promptOrder: неизвестные, дубли и мусор отбрасываются, enabled не boolean → true",
    body: {
      ...base,
      promptOrder: [
        { id: "history", enabled: "no" },
        { id: "history", enabled: false },
        { id: "bogus", enabled: true },
        null,
        { id: "postHistory", enabled: true, extra: 1 },
      ],
    },
    expected: {
      promptOrder: [
        { id: "system", enabled: true },
        { id: "lorebook", enabled: true },
        { id: "auxiliary", enabled: true },
        { id: "premise", enabled: true },
        { id: "compact", enabled: true },
        { id: "history", enabled: true },
        { id: "postHistory", enabled: true },
      ],
    },
  },
  { title: "promptOrder не массив — дефолт, не ошибка", body: { ...base, promptOrder: "x" }, expected: { promptOrder: defaultOrder } },
  { title: "promptOrder null — дефолт, не ошибка", body: { ...base, promptOrder: null }, expected: { promptOrder: defaultOrder } },
];

describe("NarratorTemplateInputDto + ValidationPipe", () => {
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
    expect(await viaDto(base)).toStrictEqual({ input: { name: "N", ...defaults } });
  });

  it("лишние поля отсекаются, элементы promptOrder — ровно { id, enabled }", async () => {
    const promptOrder = defaultOrder.map((i) => ({ ...i, extra: 1 }));
    expect(await viaDto({ ...base, promptOrder, userId: 1, id: 5 })).toStrictEqual({
      input: { name: "N", ...defaults },
    });
  });

  it("дефолтный promptOrder — новая копия, а не общий массив", async () => {
    const a = (await viaDto(base)) as { input: { promptOrder: unknown[] } };
    const b = (await viaDto(base)) as { input: { promptOrder: unknown[] } };
    expect(a.input.promptOrder).not.toBe(b.input.promptOrder);
  });
});
