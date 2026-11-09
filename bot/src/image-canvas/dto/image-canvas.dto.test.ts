import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { CanvasReferenceDto, ImageCanvasPatchDto } = await import("./image-canvas.dto.js");

async function valid(metatype: new () => object, body: unknown): Promise<boolean> {
  try {
    await createValidationPipe().transform(body, { type: "body", metatype });
    return true;
  } catch (err) {
    if (err instanceof BadRequestException) return false;
    throw err;
  }
}

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("image canvas DTO", () => {
  it("patch: известная модель, промпт строкой", async () => {
    expect(await valid(ImageCanvasPatchDto, { model: "qwen_turbo", prompt: "<image1> улыбается" })).toBe(true);
    expect(await valid(ImageCanvasPatchDto, { model: "flux" })).toBe(false);
    expect(await valid(ImageCanvasPatchDto, { prompt: "x".repeat(4001) })).toBe(false);
  });

  it("картинка — только data URL изображения", async () => {
    expect(await valid(CanvasReferenceDto, { image: PNG, thumb: PNG })).toBe(true);
    expect(await valid(CanvasReferenceDto, { image: "https://example.com/a.png", thumb: PNG })).toBe(false);
    expect(await valid(CanvasReferenceDto, { image: "data:text/html;base64,PGI+", thumb: PNG })).toBe(false);
    expect(await valid(CanvasReferenceDto, { image: PNG })).toBe(false);
  });
});
