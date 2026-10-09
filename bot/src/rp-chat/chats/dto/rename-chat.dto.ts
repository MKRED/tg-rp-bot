import { MAX_CHAT_TITLE_LENGTH, type RenameChatRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsString } from "class-validator";

/**
 * Тело PATCH /api/chats/:id. Длинное название обрезается (не 400) — чтобы не раздувать список и
 * шапку; пустое после trim (репозиторий) очищает название.
 */
export class RenameChatDto implements RenameChatRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.slice(0, MAX_CHAT_TITLE_LENGTH) : value))
  @IsString({ message: "title must be a string" })
  title!: string;
}
