import { applyDecorators } from "@nestjs/common";
import { REASONING_EFFORTS, type PresetInput, type ReasoningEffort, type SamplingKey } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { SAMPLING_RANGES } from "../presets.constants.js";

/** Флаг: только литерал true включает его, любое другое значение (или отсутствие) — false, не ошибка. */
function IsFlag(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => value === true),
    IsBoolean(),
  );
}

/** Лимит токенов: null/отсутствие — без лимита, иначе целое ≥ 1. */
function IsTokenLimit(key: string): PropertyDecorator {
  const message = `${key} must be a positive integer or null`;
  return applyDecorators(IsOptional(), IsInt({ message }), Min(1, { message }));
}

/** Параметр сэмплинга: null/отсутствие — не передавать, иначе число в диапазоне SAMPLING_RANGES. */
function IsSampling(key: SamplingKey): PropertyDecorator {
  const { min, max, integer } = SAMPLING_RANGES[key];
  const message = `Invalid value for ${key}`;
  return applyDecorators(
    IsOptional(),
    IsNumber({ allowNaN: false, allowInfinity: false }, { message }),
    Min(min, { message }),
    ...(max === undefined ? [] : [Max(max, { message })]),
    ...(integer ? [IsInt({ message })] : []),
  );
}

/**
 * Тело POST/PUT /api/presets. Поля и их смысл — контракт PresetInput из @tg-rp-bot/shared;
 * лишние поля отсекает ValidationPipe (whitelist). У каждого поля явный дефолт (null/false):
 * drizzle .set() пропускает undefined, и PUT без поля оставил бы в БД старое значение.
 */
export class PresetInputDto implements PresetInput {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Name is required" })
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @IsFlag()
  contextUnlimited = false;

  @IsTokenLimit("contextSize")
  contextSize: number | null = null;

  @IsTokenLimit("maxTokens")
  maxTokens: number | null = null;

  @IsFlag()
  streaming = false;

  @IsSampling("temperature")
  temperature: number | null = null;

  @IsSampling("topP")
  topP: number | null = null;

  @IsSampling("topK")
  topK: number | null = null;

  @IsSampling("frequencyPenalty")
  frequencyPenalty: number | null = null;

  @IsSampling("presencePenalty")
  presencePenalty: number | null = null;

  @IsSampling("repetitionPenalty")
  repetitionPenalty: number | null = null;

  @IsSampling("minP")
  minP: number | null = null;

  @IsSampling("topA")
  topA: number | null = null;

  @IsFlag()
  requestReasoning = false;

  @IsOptional()
  @IsIn(REASONING_EFFORTS, { message: "Invalid reasoningEffort" })
  reasoningEffort: ReasoningEffort | null = null;
}
