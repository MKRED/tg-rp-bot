import { applyDecorators } from "@nestjs/common";
import type { CardCategory, CardInput } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IsCardCategories } from "./card-categories.js";

/** Текст промпта: необязателен, не-строка (или отсутствие) — пустая строка, не ошибка. */
function IsPromptText(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value : "")),
    IsString(),
  );
}

/** Флаг: только литерал true включает его, любое другое значение (или отсутствие) — false, не ошибка. */
function IsFlag(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => value === true),
    IsBoolean(),
  );
}

/**
 * Тело POST/PUT /api/cards. Поля и их смысл — контракт CardInput из @tg-rp-bot/shared; лишние поля
 * отсекает ValidationPipe (whitelist). У каждого поля явный дефолт: drizzle .set() пропускает
 * undefined, и PUT без поля оставил бы в БД старое значение. Пустые systemPrompt/prompt/categories
 * здесь не подменяются дефолтами — это решает репозиторий (по-разному на вставке и на правке).
 */
export class CardInputDto implements CardInput {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Name is required" })
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @IsPromptText()
  systemPrompt = "";

  @IsPromptText()
  prompt = "";

  // Обязателен (в отличие от остальных полей): отсутствие — "categories must be an array".
  @IsCardCategories()
  categories!: CardCategory[];

  // null/отсутствие — пресет не выбран. Принадлежность пресета пользователю проверяет сервис.
  @IsOptional()
  @IsInt({ message: "presetId must be an integer" })
  presetId: number | null = null;

  @IsFlag()
  useWebSearch = false;

  @IsFlag()
  useAskUser = false;
}
