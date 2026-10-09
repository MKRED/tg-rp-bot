import { Transform } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

/**
 * Тело POST /api/cards/:id/generate. categoryId не-строкой (или без него) — не ошибка, а «следующий
 * незаполненный блок»; любая строка (даже пустая) — явная перегенерация этого блока.
 */
export class GenerateCardBlockDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value : undefined))
  @IsOptional()
  @IsString()
  categoryId?: string;
}
