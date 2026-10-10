import type { AdvanceStoryRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsString } from "class-validator";

/**
 * Тело POST /api/stories/:id/advance. Никогда не 400: не строка, пусто или тела нет — «Дальше»
 * (continue), иначе — режиссёрская директива (после trim).
 */
export class AdvanceStoryDto implements AdvanceStoryRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : ""))
  @IsString()
  directive: string = "";
}
