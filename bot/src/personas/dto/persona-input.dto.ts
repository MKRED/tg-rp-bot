import type { PersonaInput } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
import { IsDataImageUrl } from "../../common/decorators/is-data-image-url.decorator.js";
import { IsOptionalNote } from "../../common/decorators/is-optional-note.decorator.js";
import { MAX_IMAGE_CHARS, MAX_IMAGE_FULL_CHARS } from "../../server/shared/imageValidation.constants.js";

/**
 * Тело POST/PUT /api/personas. Поля и их смысл — контракт PersonaInput из @tg-rp-bot/shared;
 * лишние поля отсекает ValidationPipe (whitelist).
 */
export class PersonaInputDto implements PersonaInput {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Name is required" })
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  // Промпт необязателен: не-строка (или отсутствие) — пустая строка, не ошибка.
  @Transform(({ value }) => (typeof value === "string" ? value : ""))
  @IsString()
  prompt = "";

  @IsOptionalNote("Footnote")
  footnote: string | null = null;

  @IsDataImageUrl("Image", MAX_IMAGE_CHARS)
  image: string | null = null;

  @IsDataImageUrl("Full image", MAX_IMAGE_FULL_CHARS)
  imageFull: string | null = null;
}
