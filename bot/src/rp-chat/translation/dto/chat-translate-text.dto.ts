import { type ChatTranslateTextRequest, PROMPT_TRANSLATE_ENGINES, type PromptTranslateEngine } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsIn, ValidateBy } from "class-validator";

const REQUIRED = "text and targetLang are required";

/** Непустая после trim строка; одно общее сообщение на оба поля (фильтр схлопывает повтор). */
const NotBlank = () =>
  ValidateBy({
    name: "notBlank",
    validator: {
      validate: (value: unknown) => typeof value === "string" && value.trim().length > 0,
      defaultMessage: () => REQUIRED,
    },
  });

/**
 * Тело POST /api/chats/:id/translate-text — эфемерный перевод черновика и вариантов impersonate.
 * text уходит в перевод как есть (без trim — важны переносы); без mode — Google Translate.
 */
export class ChatTranslateTextDto implements ChatTranslateTextRequest {
  @Transform(({ value }) => (typeof value === "string" ? value : ""))
  @NotBlank()
  text: string = "";

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : ""))
  @NotBlank()
  targetLang: string = "";

  @Transform(({ value }) => (value === "ai" ? "ai" : "google"))
  @IsIn(PROMPT_TRANSLATE_ENGINES)
  mode: PromptTranslateEngine = "google";
}
