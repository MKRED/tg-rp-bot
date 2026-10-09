import {
  AUTO_TRANSLATE_SCOPES,
  type AutoTranslateScope,
  COMPACT_WORDS_MAX,
  COMPACT_WORDS_MIN,
  PROMPT_TRANSLATE_ENGINES,
  type PromptTranslateEngine,
  type StorySettings,
  TRANSLATE_SCOPES,
  type TranslateScope,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";

/** Значение из допустимого набора или undefined. */
const oneOf = (allowed: readonly unknown[]) => ({ value }: { value: unknown }) => (allowed.includes(value) ? value : undefined);
const bool = ({ value }: { value: unknown }) => (typeof value === "boolean" ? value : undefined);
const finiteInt = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined);

/**
 * Тело PUT /api/stories/:id/settings — снисходительный патч, как у настроек чата: невалидное поле
 * молча игнорируется (undefined), а не даёт 400. compactWords клампится здесь; compactFloorTokens —
 * в сервисе: его границы зависят от окна контекста пресета истории.
 */
export class UpdateStorySettingsDto implements Partial<StorySettings> {
  @Transform(bool)
  @IsOptional()
  translateEnabled?: boolean;

  @Transform(({ value }) => (typeof value === "string" ? value : undefined))
  @IsOptional()
  translateTargetLang?: string;

  @Transform(oneOf(TRANSLATE_SCOPES))
  @IsOptional()
  translateScope?: TranslateScope;

  @Transform(oneOf(AUTO_TRANSLATE_SCOPES))
  @IsOptional()
  autoTranslateScope?: AutoTranslateScope;

  @Transform(oneOf(PROMPT_TRANSLATE_ENGINES))
  @IsOptional()
  translateMethod?: PromptTranslateEngine;

  @Transform(bool)
  @IsOptional()
  compactEnabled?: boolean;

  @Transform(bool)
  @IsOptional()
  compactAutoEnabled?: boolean;

  /** Сырое целое; кламп по окну контекста пресета — в сервисе. */
  @Transform(({ value }) => finiteInt(value))
  @IsOptional()
  compactFloorTokens?: number;

  @Transform(({ value }) => {
    const n = finiteInt(value);
    return n === undefined ? undefined : Math.max(COMPACT_WORDS_MIN, Math.min(n, COMPACT_WORDS_MAX));
  })
  @IsOptional()
  compactWords?: number;

  @Transform(bool)
  @IsOptional()
  quickRollbackEnabled?: boolean;

  @Transform(bool)
  @IsOptional()
  editEnabled?: boolean;
}
