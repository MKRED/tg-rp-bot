import {
  ASK_USER_NOTE_MAX_LENGTH,
  COAUTHOR_MESSAGE_MAX_LENGTH,
  type CoauthorMessageInput,
  type CoauthorReviewInput,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

/** Тело POST /api/coauthor/:id/messages. */
export class CoauthorMessageDto implements CoauthorMessageInput {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "text is required" })
  @IsNotEmpty({ message: "text is required" })
  @MaxLength(COAUTHOR_MESSAGE_MAX_LENGTH, { message: "text is too long" })
  text!: string;
}

/** Тело POST /api/coauthor/:id/answer — как у ответа на вопросы генерации карточки, без categoryId. */
export class CoauthorAnswerDto {
  @Transform(({ value }: { value: unknown }) => value === true)
  @IsBoolean()
  skipped = false;

  @ValidateIf((dto: CoauthorAnswerDto) => !dto.skipped)
  @IsArray({ message: "answers must be a string array" })
  @IsString({ each: true, message: "answers must be a string array" })
  answers?: string[];

  @Transform(({ value }: { value: unknown }) => (typeof value === "string" && value.trim() ? value.trim() : undefined))
  @IsOptional()
  @MaxLength(ASK_USER_NOTE_MAX_LENGTH, { message: "note is too long" })
  note?: string;
}

/** Тело POST /api/coauthor/:id/review. */
export class CoauthorReviewDto implements CoauthorReviewInput {
  @IsArray({ message: "proposalIds must be a string array" })
  @ArrayMinSize(1, { message: "proposalIds is empty" })
  @IsString({ each: true, message: "proposalIds must be a string array" })
  proposalIds!: string[];

  @IsBoolean({ message: "accept must be a boolean" })
  accept!: boolean;
}
