import { applyDecorators } from "@nestjs/common";
import { MAX_CARD_REFERENCE_IMAGE_CHARS, MAX_CARD_REFERENCE_IMAGES } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { ValidateBy } from "class-validator";

const DATA_IMAGE_URL = /^data:image\//;

/** Первая ошибка массива референсов или undefined. Сообщения с индексом — как у categories. */
export function referenceImagesError(value: unknown): string | undefined {
  if (!Array.isArray(value)) return "referenceImages must be an array";
  if (value.length > MAX_CARD_REFERENCE_IMAGES) {
    return `Too many reference images (max ${MAX_CARD_REFERENCE_IMAGES})`;
  }
  for (const [index, image] of value.entries()) {
    if (typeof image !== "string" || !DATA_IMAGE_URL.test(image)) {
      return `Reference image ${index} must be a data:image/* URL`;
    }
    if (image.length > MAX_CARD_REFERENCE_IMAGE_CHARS) return `Reference image ${index} too large`;
  }
  return undefined;
}

/**
 * Референсы карточки: отсутствие поля — пустой массив (явный дефолт, как у остальных полей CardInputDto:
 * drizzle .set() пропускает undefined), любое другое не-массивное значение — ошибка.
 */
export function IsReferenceImages(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (value === undefined ? [] : value)),
    ValidateBy({
      name: "isReferenceImages",
      validator: {
        validate: (value: unknown) => referenceImagesError(value) === undefined,
        defaultMessage: (args) => referenceImagesError(args?.value) ?? "Invalid referenceImages",
      },
    }),
  );
}
