import { MAX_SEND_PHOTO_CHARS, type SendPhotoRequest } from "@tg-rp-bot/shared";
import { ValidateBy } from "class-validator";

const isDataImageUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image/");

/**
 * Обязательный data:image/*-URL. Одно правило вместо цепочки декораторов: Hono отдавал ровно одну
 * ошибку на поле (нет / не тот формат / слишком большой), а цепочка дала бы склейку из нескольких.
 */
const IsRequiredDataImageUrl = (maxChars: number) =>
  ValidateBy({
    name: "isRequiredDataImageUrl",
    validator: {
      validate: (v: unknown) => isDataImageUrl(v) && v.length <= maxChars,
      defaultMessage: (args) => {
        const v: unknown = args?.value;
        if (v === undefined || v === null) return "Image is required";
        return isDataImageUrl(v) ? "Image too large" : "Image must be a data:image/* URL";
      },
    },
  });

/** Тело POST /me/send-photo. Тексты ошибок — те же, что отдавал Hono. Лишние поля (подпись и ссылка от
 * закэшированного старого webapp) отбрасывает whitelist ValidationPipe. */
export class SendPhotoDto implements SendPhotoRequest {
  @IsRequiredDataImageUrl(MAX_SEND_PHOTO_CHARS)
  image!: string;
}
