import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { CardTemplateInputDto } = await import("./card-template-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

/** Прогон тела через тот же ValidationPipe и тот же формат ошибки, что и в приложении. */
async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: CardTemplateInputDto });
    return { input: JSON.parse(JSON.stringify(dto)) as Record<string, unknown> };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

const field = (over: Record<string, unknown> = {}) => ({
  id: "base",
  title: "Base",
  description: "Name: ...",
  enabled: true,
  ...over,
});

describe("CardTemplateInputDto", () => {
  it("явные дефолты у необязательных полей, обрезка имени и полей", async () => {
    const result = await viaDto({ name: "  NPC ", fields: [field({ id: " base ", title: " Base ", description: " D " })] });
    expect(result).toEqual({
      input: {
        name: "NPC",
        systemPrompt: "",
        fields: [{ id: "base", title: "Base", description: "D", enabled: true }],
        useWebSearch: false,
        useAskUser: false,
        askUserFirst: false,
      },
    });
  });

  it("лишнее content у поля отбрасывается", async () => {
    const result = await viaDto({ name: "N", fields: [field({ content: "текст" })] });
    expect("input" in result && result.input.fields).toEqual([field()]);
  });

  it("пустой шаблон — ошибка", async () => {
    expect(await viaDto({ name: "N", fields: [] })).toEqual({ error: "At least one field is required" });
  });

  it("ошибка поля называет индекс и поле", async () => {
    expect(await viaDto({ name: "N", fields: [field(), field({ id: "x", enabled: "yes" })] })).toEqual({
      error: "Field 1: enabled must be a boolean",
    });
  });

  it("дубль id после обрезки — ошибка", async () => {
    expect(await viaDto({ name: "N", fields: [field(), field({ id: " base" })] })).toEqual({
      error: "Field 1: duplicate id",
    });
  });

  it("без имени — ошибка", async () => {
    expect(await viaDto({ name: "  ", fields: [field()] })).toEqual({ error: "Name is required" });
  });
});
