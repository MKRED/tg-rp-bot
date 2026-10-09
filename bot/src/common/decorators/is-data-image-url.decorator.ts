import { applyDecorators } from "@nestjs/common";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

const DATA_IMAGE_URL = /^data:image\//;

/**
 * Поле-картинка (аватар персонажа/персоны): null или отсутствие — нет картинки, иначе
 * data:image/*-URL не длиннее maxChars. Тексты ошибок — те же, что отдавал Hono
 * (`<label> must be a data:image/* URL`, `<label> too large`). Значение по умолчанию (null)
 * задаётся в самом DTO.
 */
export function IsDataImageUrl(label: string, maxChars: number): PropertyDecorator {
  const formatMessage = `${label} must be a data:image/* URL`;
  return applyDecorators(
    IsOptional(),
    IsString({ message: formatMessage }),
    Matches(DATA_IMAGE_URL, { message: formatMessage }),
    MaxLength(maxChars, { message: `${label} too large` }),
  );
}
