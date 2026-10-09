import { MAX_STORY_TITLE_LENGTH, type UpdateStoryRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsOptional, IsString, ValidateIf } from "class-validator";

const MESSAGE = "title or premise must be a string";
const stringOrUndefined = ({ value }: { value: unknown }) => (typeof value === "string" ? value : undefined);

/**
 * Тело PATCH /api/stories/:id. Webapp шлёт title и premise отдельными запросами; нужен хотя бы один
 * (иначе 400), если пришли оба — сервис применяет только title. Длинное название обрезается (не 400);
 * премиза не обрезается — это вводная-сценарий, может быть длинной.
 */
export class UpdateStoryDto implements UpdateStoryRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.slice(0, MAX_STORY_TITLE_LENGTH) : undefined))
  @ValidateIf((o: UpdateStoryDto) => o.premise === undefined)
  @IsString({ message: MESSAGE })
  title?: string;

  @Transform(stringOrUndefined)
  @IsOptional()
  @IsString({ message: MESSAGE })
  premise?: string;
}
