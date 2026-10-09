import {
  PROMPT_TRANSLATE_ENGINES,
  PROMPT_TRANSLATE_REASONING_LEVELS,
  type LlmSettingsPatch,
  type PromptTranslateEngine,
  type PromptTranslateReasoningEffort,
  type TavilySettingsPatch,
  type TranslateSettingsPatch,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { ApiKeyPatch, OneOf, TrimmedNonEmpty } from "./settings-transforms.js";

/** Тело PATCH /api/settings/llm. Без дефолтов — см. settings-transforms.ts. */
export class LlmSettingsPatchDto implements LlmSettingsPatch {
  @ApiKeyPatch()
  @IsOptional()
  @IsString()
  apiKey?: string | null;

  @TrimmedNonEmpty()
  @IsOptional()
  @IsString()
  model?: string;
}

/** Тело PATCH /api/settings/tavily. */
export class TavilySettingsPatchDto implements TavilySettingsPatch {
  @ApiKeyPatch()
  @IsOptional()
  @IsString()
  apiKey?: string | null;

  // Любое число (в т.ч. дробное/отрицательное и 1e999 → Infinity) — кламп в репозитории; строка "5" —
  // игнорируется. allowInfinity: иначе IsNumber дал бы 400 там, где Hono-версия клампила.
  @Transform(({ value }: { value: unknown }) => (typeof value === "number" ? value : undefined))
  @IsOptional()
  @IsNumber({ allowInfinity: true })
  maxSearchRounds?: number;
}

/** Тело PATCH /api/settings/translate. */
export class TranslateSettingsPatchDto implements TranslateSettingsPatch {
  @OneOf(PROMPT_TRANSLATE_ENGINES)
  @IsOptional()
  @IsIn(PROMPT_TRANSLATE_ENGINES)
  engine?: PromptTranslateEngine;

  @TrimmedNonEmpty()
  @IsOptional()
  @IsString()
  targetLang?: string;

  // Не обрезается: пробелы/переводы строк в своём промпте — часть текста пользователя.
  @Transform(({ value }: { value: unknown }) => (value === null || typeof value === "string" ? value : undefined))
  @IsOptional()
  @IsString()
  promptTemplate?: string | null;

  @OneOf(PROMPT_TRANSLATE_REASONING_LEVELS)
  @IsOptional()
  @IsIn(PROMPT_TRANSLATE_REASONING_LEVELS)
  reasoningEffort?: PromptTranslateReasoningEffort;
}

/** Тело POST /api/settings/{llm,tavily}/verify: пустой apiKey — проверить уже сохранённый ключ. */
export class VerifyKeyDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : ""))
  @IsString()
  apiKey = "";
}
