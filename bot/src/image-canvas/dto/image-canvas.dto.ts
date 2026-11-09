import {
  MAX_CANVAS_IMAGE_CHARS,
  MAX_CANVAS_PROMPT_CHARS,
  MAX_CANVAS_THUMB_CHARS,
  type CanvasReferenceInput,
  type ComfyModelId,
  type ImageCanvasPatch,
  type SaveCanvasDraftInput,
} from "@tg-rp-bot/shared";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

/** Картинка — только data URL изображения в base64 (сервер его разбирает и грузит в ComfyUI). */
const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MODELS: ComfyModelId[] = ["qwen", "qwen_turbo"];

/** POST /api/image-canvases — название необязательно (по умолчанию «Новый холст»). */
export class CreateImageCanvasDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

/** PATCH /api/image-canvases/:id — только переданные поля. */
export class ImageCanvasPatchDto implements ImageCanvasPatch {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(MODELS, { message: "Unknown model" })
  model?: ComfyModelId;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CANVAS_PROMPT_CHARS, { message: "Prompt is too long" })
  prompt?: string;
}

/** PUT /api/image-canvases/:id/references/:slot */
export class CanvasReferenceDto implements CanvasReferenceInput {
  @IsString()
  @MaxLength(MAX_CANVAS_IMAGE_CHARS, { message: "Image is too large" })
  @Matches(DATA_IMAGE, { message: "image must be a PNG, JPEG or WebP data URL" })
  image!: string;

  @IsString()
  @MaxLength(MAX_CANVAS_THUMB_CHARS, { message: "Thumbnail is too large" })
  @Matches(DATA_IMAGE, { message: "thumb must be a PNG, JPEG or WebP data URL" })
  thumb!: string;
}

/** POST /api/image-canvases/:id/items/:itemId/save */
export class SaveCanvasDraftDto implements SaveCanvasDraftInput {
  @IsString()
  @MaxLength(MAX_CANVAS_THUMB_CHARS, { message: "Thumbnail is too large" })
  @Matches(DATA_IMAGE, { message: "thumb must be a PNG, JPEG or WebP data URL" })
  thumb!: string;
}
