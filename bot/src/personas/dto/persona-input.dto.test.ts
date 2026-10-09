import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { PersonaInputDto } = await import("./persona-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

/** Прогон тела через тот же ValidationPipe и тот же формат ошибки, что и в приложении. */
async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: PersonaInputDto });
    return { input: { ...dto } };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

const image = "data:image/jpeg;base64,AAAA";
const defaults = { prompt: "", footnote: null, image: null, imageFull: null };

// Характеризация: ожидания сняты с прежнего ручного парсера Hono-версии (parsePersonaInput).
const cases: { title: string; body: unknown; expected: Record<string, unknown> | string }[] = [
  { title: "минимальное тело — дефолты", body: { name: "Я" }, expected: { name: "Я", ...defaults } },
  { title: "имя обрезается", body: { name: "  Боб  " }, expected: { name: "Боб" } },
  { title: "пустое имя", body: { name: "  " }, expected: "Name is required" },
  { title: "имени нет", body: {}, expected: "Name is required" },
  { title: "имя не строка", body: { name: 5 }, expected: "Name is required" },
  { title: "prompt не строка → пусто", body: { name: "A", prompt: 1 }, expected: { prompt: "" } },
  { title: "prompt строка", body: { name: "A", prompt: "p" }, expected: { prompt: "p" } },
  // в отличие от персонажа, пустое примечание не превращается в null
  { title: "footnote пустая остаётся пустой", body: { name: "A", footnote: "" }, expected: { footnote: "" } },
  { title: "footnote null", body: { name: "A", footnote: null }, expected: { footnote: null } },
  { title: "footnote не строка", body: { name: "A", footnote: 1 }, expected: "Footnote must be a string" },
  { title: "картинки data URL", body: { name: "A", image, imageFull: image }, expected: { image, imageFull: image } },
  { title: "картинка не data URL", body: { name: "A", image: "http://x" }, expected: "Image must be a data:image/* URL" },
  { title: "картинка не строка", body: { name: "A", image: 1 }, expected: "Image must be a data:image/* URL" },
  {
    title: "полное фото не data URL",
    body: { name: "A", imageFull: "x" },
    expected: "Full image must be a data:image/* URL",
  },
  {
    title: "картинка слишком большая",
    body: { name: "A", image: `data:image/png;base64,${"A".repeat(900_000)}` },
    expected: "Image too large",
  },
  {
    title: "полное фото слишком большое",
    body: { name: "A", imageFull: `data:image/png;base64,${"A".repeat(2_500_000)}` },
    expected: "Full image too large",
  },
];

describe("PersonaInputDto + ValidationPipe", () => {
  it.each(cases)("$title", async ({ body, expected }) => {
    const result = await viaDto(body);
    if (typeof expected === "string") {
      // DTO отдаёт все нарушения сразу (через «; »), прежний парсер — только первое.
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error.split("; ")).toContain(expected);
    } else {
      expect(result).toMatchObject({ input: expected });
    }
  });

  it("лишние поля отсекаются", async () => {
    const result = await viaDto({ name: "A", userId: 1, id: 99 });
    expect(result).toEqual({ input: { name: "A", ...defaults } });
  });
});
