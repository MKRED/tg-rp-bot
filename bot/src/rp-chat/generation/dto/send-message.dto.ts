import type { SendMessageRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty } from "class-validator";

/** Тело POST .../messages (отправка) и .../messages/:msgId/edit: реплика после trim не пустая. */
export class SendMessageDto implements SendMessageRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : ""))
  @IsNotEmpty({ message: "content is required" })
  content: string = "";
}
