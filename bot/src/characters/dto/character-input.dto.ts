import { type CharacterInput, MAX_FIRST_MESSAGES } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString } from "class-validator";
import { IsDataImageUrl } from "../../common/decorators/is-data-image-url.decorator.js";
import { IsOptionalNote } from "../../common/decorators/is-optional-note.decorator.js";
import { MAX_IMAGE_CHARS, MAX_IMAGE_FULL_CHARS } from "../../common/image-limits.js";

/**
 * Тело POST/PUT /api/characters. Поля и их смысл — контракт CharacterInput из @tg-rp-bot/shared;
 * лишние поля отсекает ValidationPipe (whitelist).
 */
export class CharacterInputDto implements CharacterInput {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Name is required" })
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @IsArray({ message: "Tags must be an array of strings" })
  @IsString({ each: true, message: "Tags must be an array of strings" })
  tags!: string[];

  @IsOptionalNote("Footnote")
  footnote: string | null = null;

  // Промпт и сценарий необязательны: не-строка (или отсутствие) — пустая строка, не ошибка.
  @Transform(({ value }) => (typeof value === "string" ? value : ""))
  @IsString()
  prompt = "";

  @Transform(({ value }) => (typeof value === "string" ? value : ""))
  @IsString()
  scenario = "";

  @IsArray({ message: "firstMessages must be an array of strings" })
  @IsString({ each: true, message: "firstMessages must be an array of strings" })
  @ArrayMaxSize(MAX_FIRST_MESSAGES, { message: `Too many first messages (max ${MAX_FIRST_MESSAGES})` })
  firstMessages!: string[];

  @IsDataImageUrl("Image", MAX_IMAGE_CHARS)
  image: string | null = null;

  @IsDataImageUrl("Full image", MAX_IMAGE_FULL_CHARS)
  imageFull: string | null = null;
}
