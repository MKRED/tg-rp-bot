import {
  MAX_TRANSLATE_BLOCKS_PER_REQUEST,
  type PromptTranslateEngine,
  type TranslateTextRequest,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsIn, IsNotEmpty } from "class-validator";

/** Одно сообщение на любую ошибку тела — как у Hono-контроллера (webapp показывает его как есть). */
const INVALID = {
  message: `blocks (1..${MAX_TRANSLATE_BLOCKS_PER_REQUEST}), sourceLang and targetLang are required`,
};

/** Строка после trim; не строка → "" (дальше её отсекает IsNotEmpty). */
const TrimmedString = () => Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : ""));

/**
 * Тело POST /translate/text. Разбор исторически снисходителен: не-строки в blocks выкидываются
 * молча (а не 400), неизвестный mode — google. 400 только когда переводить нечего или не заданы языки.
 */
export class TranslateTextDto implements TranslateTextRequest {
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.filter((b): b is string => typeof b === "string") : [],
  )
  @ArrayMinSize(1, INVALID)
  @ArrayMaxSize(MAX_TRANSLATE_BLOCKS_PER_REQUEST, INVALID)
  blocks!: string[];

  @TrimmedString()
  @IsNotEmpty(INVALID)
  sourceLang!: string;

  @TrimmedString()
  @IsNotEmpty(INVALID)
  targetLang!: string;

  @Transform(({ value }: { value: unknown }) => (value === "ai" ? "ai" : "google"))
  @IsIn(["google", "ai"])
  mode: PromptTranslateEngine = "google";
}
