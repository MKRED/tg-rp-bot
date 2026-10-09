import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsNotEmpty, IsString, ValidateIf } from "class-validator";

const ANSWERS_MESSAGE = "answers must be a string array";

/**
 * Тело POST /api/cards/:id/generate/answer — ответы на вопросы ask_user одной категории.
 * skipped: true — пользователь отказался отвечать, answers тогда не читается и не проверяется.
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
}
