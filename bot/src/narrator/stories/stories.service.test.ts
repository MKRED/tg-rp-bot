import type { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { StoriesService } = await import("./stories.service.js");
type A = ConstructorParameters<typeof StoriesService>;

const INPUT = { bookId: 1, templateId: 2, presetId: 3, openingBeat: "Начало", premise: "" };

function setup() {
  const stories = {
    create: vi.fn().mockResolvedValue({ id: 10 }),
    rename: vi.fn().mockResolvedValue({ title: "Т" }),
    updatePremise: vi.fn().mockResolvedValue({ premise: "П" }),
  };
  const books = { findOne: vi.fn().mockResolvedValue({ id: 1 }) };
  const templates = { findOne: vi.fn().mockResolvedValue({ id: 2 }) };
  const presets = { findOne: vi.fn().mockResolvedValue({ id: 3 }) };
  const service = new StoriesService(
    stories as unknown as A[0],
    {} as A[1],
    {} as A[2],
    books as unknown as A[3],
    templates as unknown as A[4],
    presets as unknown as A[5],
  );
  return { service, stories, books, templates, presets };
}

const message = async (p: Promise<unknown>) => ((await p.catch((e: unknown) => e)) as HttpException).message;

describe("StoriesService.create", () => {
  it("свои книга, шаблон и пресет — история с открытием", async () => {
    const { service, stories } = setup();
    await service.create(1, INPUT);
    expect(stories.create).toHaveBeenCalledWith(1, { bookId: 1, templateId: 2, presetId: 3 }, "Начало", "");
  });

  it.each([
    { missing: "books", msg: "Book not found" },
    { missing: "templates", msg: "Template not found" },
    { missing: "presets", msg: "Preset not found" },
  ] as const)("чужое или нет: $missing → 404 $msg, ничего не создаём", async ({ missing, msg }) => {
    const s = setup();
    s[missing].findOne.mockResolvedValueOnce(undefined);
    expect(await message(s.service.create(1, INPUT))).toBe(msg);
    expect(s.stories.create).not.toHaveBeenCalled();
  });
});

describe("StoriesService.update", () => {
  it("оба поля — применяется только title", async () => {
    const { service, stories } = setup();
    expect(await service.update(1, 5, { title: "Т", premise: "П" })).toEqual({ title: "Т" });
    expect(stories.updatePremise).not.toHaveBeenCalled();
  });

  it("только premise — ответ { premise }", async () => {
    const { service } = setup();
    expect(await service.update(1, 5, { premise: "П" })).toEqual({ premise: "П" });
  });

  it("чужая история — 404", async () => {
    const { service, stories } = setup();
    stories.rename.mockResolvedValueOnce(undefined);
    expect(await message(service.update(1, 5, { title: "Т" }))).toBe("Story not found");
  });
});
