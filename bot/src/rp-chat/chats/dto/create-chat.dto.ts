import type { CreateChatRequest } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNumber } from "class-validator";

/**
 * Тело POST /api/chats. Персона, RP-шаблон и пресет обязательны (NOT NULL в схеме) — играть без
 * персоны нельзя. Принадлежность всех сущностей пользователю проверяет сервис (404).
 */
export class CreateChatDto implements CreateChatRequest {
  @IsNumber({}, { message: "characterId is required" })
  characterId!: number;

  @IsNumber({}, { message: "personaId is required" })
  personaId!: number;

  @IsNumber({}, { message: "templateId is required" })
  templateId!: number;

  @IsNumber({}, { message: "presetId is required" })
  presetId!: number;

  /** Не число → 0 (первое приветствие); вне диапазона приветствий — чат стартует пустым (сервис). */
  @Transform(({ value }) => (typeof value === "number" ? value : 0))
  @IsNumber()
  firstMessageIndex: number = 0;
}
