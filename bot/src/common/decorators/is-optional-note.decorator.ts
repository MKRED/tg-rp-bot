import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

/**
 * Необязательная заметка «для себя» (footnote персонажа/персоны): отсутствие, null и пустая строка
 * хранятся одинаково — как null, чтобы в БД не было двух видов «пусто». webapp и так шлёт null
 * (trim() || null), это защита последнего рубежа. Значение по умолчанию (null) задаётся в DTO.
 */
export function IsOptionalNote(label: string): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (value === "" ? null : value)),
    IsOptional(),
    IsString({ message: `${label} must be a string` }),
  );
}
