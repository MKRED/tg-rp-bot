import {
  AUTO_TRANSLATE_SCOPES,
  type AutoTranslateScope,
  type ChatSettings,
  PROMPT_TRANSLATE_ENGINES,
  type PromptTranslateEngine,
  TRANSLATE_SCOPES,
  type TranslateScope,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsOptional } from "class-validator";

/** Значение из допустимого набора или undefined. */
const oneOf = (allowed: readonly unknown[]) => ({ value }: { value: unknown }) =>
  allowed.includes(value) ? value : undefined;

/**
 * Тело PUT /api/chats/:id/settings — снисходительный патч: невалидное поле молча игнорируется
 * (undefined), а не даёт 400; сохраняются только переданные корректные поля.
 */
export class UpdateChatSettingsDto implements Partial<ChatSettings> {
  @Transform(({ value }) => (typeof value === "boolean" ? value : undefined))
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
}
