import { Transform } from "class-transformer";
import { ASK_USER_NOTE_MAX_LENGTH } from "@tg-rp-bot/shared";
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

const ANSWERS_MESSAGE = "answers must be a string array";

/**
 * Тело POST /api/cards/:id/generate/answer — ответы на вопросы ask_user одной категории.
 * skipped: true — пользователь отказался отвечать, answers тогда не читается и не проверяется.
 * note — дополнение пользователя от себя, читается при любом skipped.
 */
export class AnswerCardQuestionsDto {
  // Без обрезки: id категории сверяется с сохранённым как есть.
  @IsString({ message: "categoryId is required" })
  @IsNotEmpty({ message: "categoryId is required" })
  categoryId!: string;

  @Transform(({ value }: { value: unknown }) => value === true)
  @IsBoolean()
  skipped = false;

  @ValidateIf((dto: AnswerCardQuestionsDto) => !dto.skipped)
  @IsArray({ message: ANSWERS_MESSAGE })
  @IsString({ each: true, message: ANSWERS_MESSAGE })
  answers?: string[];

  // Дополнение от себя: обрезается, пустое и не-строка — как отсутствие (поле необязательное).
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" && value.trim() ? value.trim() : undefined))
  @IsOptional()
  @MaxLength(ASK_USER_NOTE_MAX_LENGTH, { message: "note is too long" })
  note?: string;
}
