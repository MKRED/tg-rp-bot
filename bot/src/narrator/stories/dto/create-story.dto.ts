import type { CreateStoryRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

const trimmedOrEmpty = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : "");

/**
 * Тело POST /api/stories. Книга, шаблон, пресет и стартовый бит обязательны; поля объявлены в
 * порядке проверок Hono (bookId → openingBeat → templateId → presetId). Принадлежность книги,
 * шаблона и пресета пользователю проверяет сервис (404).
 */
export class CreateStoryDto implements CreateStoryRequest {
  @IsNumber({}, { message: "bookId is required" })
  bookId!: number;

  /** Авторское открытие — дословный бит 1 истории. */
  @Transform(trimmedOrEmpty)
  @IsNotEmpty({ message: "openingBeat is required" })
  openingBeat: string = "";

  @IsNumber({}, { message: "templateId is required" })
  templateId!: number;

  @IsNumber({}, { message: "presetId is required" })
  presetId!: number;

  /** Необязательная вводная; не строка → пусто. */
  @Transform(trimmedOrEmpty)
  @IsString()
  premise: string = "";
}
