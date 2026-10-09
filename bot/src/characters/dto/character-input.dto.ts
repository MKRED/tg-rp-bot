import { type CharacterInput, MAX_FIRST_MESSAGES } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { MAX_IMAGE_CHARS, MAX_IMAGE_FULL_CHARS } from "../../server/shared/imageValidation.constants.js";

const DATA_IMAGE_URL = /^data:image\//;

/** Пустое примечание храним как null — так же, как отсутствующее. */
const emptyToNull = ({ value }: { value: unknown }) => (value === "" ? null : value);

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

  @Transform(emptyToNull)
  @IsOptional()
  @IsString({ message: "Footnote must be a string" })
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

  @IsOptional()
  @IsString({ message: "Image must be a data:image/* URL" })
  @Matches(DATA_IMAGE_URL, { message: "Image must be a data:image/* URL" })
  @MaxLength(MAX_IMAGE_CHARS, { message: "Image too large" })
  image: string | null = null;

  @IsOptional()
  @IsString({ message: "Full image must be a data:image/* URL" })
  @Matches(DATA_IMAGE_URL, { message: "Full image must be a data:image/* URL" })
  @MaxLength(MAX_IMAGE_FULL_CHARS, { message: "Full image too large" })
  imageFull: string | null = null;
}
