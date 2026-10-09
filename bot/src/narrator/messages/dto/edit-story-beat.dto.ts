import type { EditStoryBeatRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty } from "class-validator";

/** Тело POST /api/stories/:id/messages/:msgId/edit — новый текст бита (после trim непустой). */
export class EditStoryBeatDto implements EditStoryBeatRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : ""))
  @IsNotEmpty({ message: "content is required" })
  content: string = "";
}
