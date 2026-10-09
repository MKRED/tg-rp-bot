import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { CharacterInputDto } = await import("./character-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

/** Прогон тела через тот же ValidationPipe и тот же формат ошибки, что и в приложении. */
async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: CharacterInputDto });
    return { input: { ...dto } };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

const valid = { name: "Алиса", tags: ["a"], firstMessages: ["hi"] };
const image = "data:image/jpeg;base64,AAAA";

// Характеризация: ожидания сняты с прежнего ручного парсера Hono-версии (до переезда на Nest
// таблица прогонялась и по нему) — поведение API для webapp не изменилось.
const cases: { title: string; body: unknown; expected: Record<string, unknown> | string }[] = [
  {
    title: "минимальное тело — дефолты",
    body: valid,
    expected: { ...valid, prompt: "", scenario: "", footnote: null, image: null, imageFull: null },
  },
  { title: "имя обрезается", body: { ...valid, name: "  Боб  " }, expected: { name: "Боб" } },
  { title: "пустое имя", body: { ...valid, name: "   " }, expected: "Name is required" },
  { title: "имя не строка", body: { ...valid, name: 5 }, expected: "Name is required" },
  { title: "prompt не строка → пусто", body: { ...valid, prompt: 1, scenario: null }, expected: { prompt: "", scenario: "" } },
  { title: "footnote пустая → null", body: { ...valid, footnote: "" }, expected: { footnote: null } },
  { title: "footnote строка", body: { ...valid, footnote: "x" }, expected: { footnote: "x" } },
  { title: "footnote не строка", body: { ...valid, footnote: 1 }, expected: "Footnote must be a string" },
  { title: "теги не массив", body: { ...valid, tags: "a" }, expected: "Tags must be an array of strings" },
  { title: "тег не строка", body: { ...valid, tags: [1] }, expected: "Tags must be an array of strings" },
  { title: "firstMessages нет", body: { name: "A", tags: [] }, expected: "firstMessages must be an array of strings" },
  {
    title: "11 первых сообщений",
    body: { ...valid, firstMessages: Array.from({ length: 11 }, () => "m") },
    expected: "Too many first messages (max 10)",
  },
  { title: "картинка data URL", body: { ...valid, image, imageFull: image }, expected: { image, imageFull: image } },
  { title: "картинка не data URL", body: { ...valid, image: "http://x" }, expected: "Image must be a data:image/* URL" },
  { title: "картинка пустая строка", body: { ...valid, image: "" }, expected: "Image must be a data:image/* URL" },
  {
    title: "картинка слишком большая",
    body: { ...valid, image: `data:image/png;base64,${"A".repeat(900_000)}` },
    expected: "Image too large",
  },
  {
    title: "полное фото слишком большое",
    body: { ...valid, imageFull: `data:image/png;base64,${"A".repeat(2_500_000)}` },
    expected: "Full image too large",
  },
];

describe("CharacterInputDto + ValidationPipe", () => {
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
});

describe("CharacterInputDto — только DTO", () => {
  it("лишние поля отсекаются", async () => {
    const result = await viaDto({ ...valid, userId: 1, id: 99 });
    expect(result).toEqual({
      input: { ...valid, prompt: "", scenario: "", footnote: null, image: null, imageFull: null },
    });
  });
});
