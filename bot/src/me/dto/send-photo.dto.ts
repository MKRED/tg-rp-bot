import { DEEP_LINK_PATH_RE, MAX_PHOTO_BUTTON_LABEL, type SendPhotoRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty, Matches, ValidateBy } from "class-validator";
import { MAX_IMAGE_FULL_CHARS } from "../../common/image-limits.js";

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

/** Тело POST /me/send-photo. Тексты ошибок — те же, что отдавал Hono. */
export class SendPhotoDto implements SendPhotoRequest {
  /** Лимит — как у полноразмерного фото персонажа. */
  @IsRequiredDataImageUrl(MAX_IMAGE_FULL_CHARS)
  image!: string;

  /** Подпись кнопки: обрезается по trim и до лимита Telegram, а не отклоняется. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().slice(0, MAX_PHOTO_BUTTON_LABEL) : "",
  )
  @IsNotEmpty({ message: "Label is required" })
  label!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value : ""))
  @Matches(DEEP_LINK_PATH_RE, { message: "Invalid deepLink" })
  deepLink!: string;
}
