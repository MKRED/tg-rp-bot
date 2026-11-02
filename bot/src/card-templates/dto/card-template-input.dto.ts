import type { CardField, CardTemplateInput } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
import { IsCardFields } from "../../cards/dto/card-categories.js";
import { IsFlag, IsPromptText } from "../../cards/dto/card-input.dto.js";

/**
 * Тело POST/PUT /api/card-templates — контракт CardTemplateInput из @tg-rp-bot/shared. Как и у
 * CardInputDto, у каждого необязательного поля явный дефолт: drizzle .set() пропускает undefined.
 */
export class CardTemplateInputDto implements CardTemplateInput {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Name is required" })
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @IsPromptText()
  systemPrompt = "";

  // Обязателен и непуст: шаблон без полей бессмыслен (см. fieldsError).
  @IsCardFields()
  fields!: CardField[];

  @IsFlag()
  useWebSearch = false;

  @IsFlag()
  useAskUser = false;

  @IsFlag()
  askUserFirst = false;
}
