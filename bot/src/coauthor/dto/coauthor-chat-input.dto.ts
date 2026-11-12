import {
  COAUTHOR_LIMITS,
  COAUTHOR_SYSTEM_PROMPT_MAX_LENGTH,
  MAX_COAUTHOR_CARDS,
  type CoauthorChatInput,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
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
  useWebSearch = false;

  @IsFlag()
  useImages = false;

  // Лимиты хода — границы и дефолты из общего контракта (COAUTHOR_LIMITS), webapp ограничивает так же.
  @IsInt({ message: "maxRounds must be an integer" })
  @Min(COAUTHOR_LIMITS.rounds.min)
  @Max(COAUTHOR_LIMITS.rounds.max)
  maxRounds: number = COAUTHOR_LIMITS.rounds.default;

  @IsInt({ message: "maxEdits must be an integer" })
  @Min(COAUTHOR_LIMITS.edits.min)
  @Max(COAUTHOR_LIMITS.edits.max)
  maxEdits: number = COAUTHOR_LIMITS.edits.default;

  @IsInt({ message: "maxQuestions must be an integer" })
  @Min(COAUTHOR_LIMITS.questions.min)
  @Max(COAUTHOR_LIMITS.questions.max)
  maxQuestions: number = COAUTHOR_LIMITS.questions.default;
}
