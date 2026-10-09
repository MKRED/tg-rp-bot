import type { TranslateMessageRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsNotEmpty } from "class-validator";

/** Тело POST .../messages/:msgId/translate. Метод (google/ai) — из настроек чата, не из тела. */
export class TranslateMessageDto implements TranslateMessageRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : ""))
  @IsNotEmpty({ message: "targetLang is required" })
  targetLang: string = "";

  /** Только true пропускает кэш; любое другое значение — false. */
  @Transform(({ value }) => value === true)
  @IsBoolean()
  force: boolean = false;
}
