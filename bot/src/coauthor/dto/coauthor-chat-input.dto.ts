import {
  COAUTHOR_SYSTEM_PROMPT_MAX_LENGTH,
  MAX_COAUTHOR_CARDS,
  type CoauthorChatInput,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsFlag, IsPromptText } from "../../cards/dto/card-input.dto.js";

/**
 * Тело POST/PUT /api/coauthor — настройки чата. У полей явные дефолты: PUT без поля не должен
 * оставлять в БД старое значение (drizzle .set() пропускает undefined). Повторы в cardIds схлопываются.
 */
export class CoauthorChatInputDto implements CoauthorChatInput {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Name is required" })
  @IsNotEmpty({ message: "Name is required" })
  @MaxLength(200)
  name!: string;

  @Transform(({ value }: { value: unknown }) => (Array.isArray(value) ? [...new Set(value)] : value))
  @IsArray({ message: "cardIds must be an array" })
  @ArrayMinSize(1, { message: "Add at least one card" })
  @ArrayMaxSize(MAX_COAUTHOR_CARDS, { message: `At most ${MAX_COAUTHOR_CARDS} cards` })
  @IsInt({ each: true, message: "cardIds must be integers" })
  cardIds!: number[];

  @IsOptional()
  @IsInt({ message: "presetId must be an integer" })
  presetId: number | null = null;

  @IsPromptText()
  @MaxLength(COAUTHOR_SYSTEM_PROMPT_MAX_LENGTH, { message: "systemPrompt is too long" })
  systemPrompt = "";

  @IsFlag()
  useAskUser = false;

  @IsFlag()
  useWebSearch = false;

  @IsFlag()
  useImages = false;
}
