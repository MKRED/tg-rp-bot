import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { CoauthorChatInputDto } = await import("./coauthor-chat-input.dto.js");

type Parsed = { input: Record<string, unknown> } | { error: string };

async function viaDto(body: unknown): Promise<Parsed> {
  try {
    const dto = await createValidationPipe().transform(body, { type: "body", metatype: CoauthorChatInputDto });
    return { input: JSON.parse(JSON.stringify(dto)) as Record<string, unknown> };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

describe("CoauthorChatInputDto", () => {
  it("дефолты у всех полей, повторы карточек схлопываются", async () => {
    expect(await viaDto({ name: " Sisters ", cardIds: [3, 3, 5] })).toEqual({
      input: { name: "Sisters", cardIds: [3, 5], presetId: null, systemPrompt: "", useAskUser: false, useWebSearch: false, useImages: false },
    });
  });

  it("без карточек и больше четырёх — ошибка", async () => {
    expect(await viaDto({ name: "A", cardIds: [] })).toHaveProperty("error");
    expect(await viaDto({ name: "A", cardIds: [1, 2, 3, 4, 5] })).toHaveProperty("error");
  });

  it("пустое название — ошибка", async () => {
    expect(await viaDto({ name: "  ", cardIds: [1] })).toHaveProperty("error");
  });
});
