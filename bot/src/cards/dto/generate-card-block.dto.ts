import type { GenerateCardBlockInput } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

/**
 * Тело POST /api/cards/:id/generate. categoryId не-строкой (или без него) — не ошибка, а «следующий
 * незаполненный блок»; любая строка (даже пустая) — явная перегенерация этого блока. forceAskUser —
 * только строгое true (кнопка «с вопросами»), всё остальное — как отсутствие.
 */
export class GenerateCardBlockDto implements GenerateCardBlockInput {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value : undefined))
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Transform(({ value }: { value: unknown }) => (value === true ? true : undefined))
  @IsOptional()
  @IsBoolean()
  forceAskUser?: boolean;
}
