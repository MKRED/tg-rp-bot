import type { LlmDebugSettingsPatch } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional } from "class-validator";

/** Число любого вида (кламп — в репозитории), иначе — не трогать. */
const AnyNumber = () => Transform(({ value }: { value: unknown }) => (typeof value === "number" ? value : undefined));

/**
 * Тело PATCH /api/debug/llm/settings. Как и в Hono-версии, поле неподходящего типа не даёт 400, а
 * игнорируется (undefined — «не трогать»). Дефолтов нет намеренно: дефолт перезаписал бы настройку.
 * allowInfinity: 1e999 из JSON — Infinity, его клампит репозиторий, а не отклоняет валидатор.
 */
export class LlmDebugSettingsPatchDto implements LlmDebugSettingsPatch {
  @Transform(({ value }: { value: unknown }) => (typeof value === "boolean" ? value : undefined))
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @AnyNumber()
  @IsOptional()
  @IsNumber({ allowInfinity: true })
  maxRequests?: number;

  @AnyNumber()
  @IsOptional()
  @IsNumber({ allowInfinity: true })
  headMessages?: number;

  @AnyNumber()
  @IsOptional()
  @IsNumber({ allowInfinity: true })
  tailMessages?: number;
}
