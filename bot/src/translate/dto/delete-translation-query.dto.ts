import { Transform } from "class-transformer";
import { IsNotEmpty } from "class-validator";

/** Query DELETE .../messages/:msgId/translate?lang=xx. Повтор параметра — первое значение (как в Hono). */
export class DeleteTranslationQueryDto {
  @Transform(({ value }) => {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    return typeof first === "string" ? first.trim() : "";
  })
  @IsNotEmpty({ message: "lang is required" })
  lang: string = "";
}
