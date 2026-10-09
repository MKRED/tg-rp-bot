import { applyDecorators } from "@nestjs/common";
import {
  PROMPT_COMPONENT_IDS,
  type PromptComponentId,
  type PromptOrderItem,
  type RpTemplateInput,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsString, ValidateBy } from "class-validator";

/** promptOrder валиден: ровно все компоненты PROMPT_COMPONENT_IDS, каждый по разу, enabled — boolean. */
function isPromptOrder(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== PROMPT_COMPONENT_IDS.length) return false;
  const seen = new Set<unknown>();
  for (const item of value) {
    if (typeof item !== "object" || item === null) return false;
    const { id, enabled } = item as Record<string, unknown>;
    if (!PROMPT_COMPONENT_IDS.includes(id as PromptComponentId)) return false;
    if (typeof enabled !== "boolean" || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/**
 * Порядок промптов. Элементы сводятся к { id, enabled }: whitelist ValidationPipe чистит только
 * поля самого DTO, во вложенных объектах лишние ключи иначе дошли бы до jsonb-колонки.
 */
function IsPromptOrder(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      Array.isArray(value)
        ? value.map((item: unknown) =>
            typeof item === "object" && item !== null
              ? { id: (item as PromptOrderItem).id, enabled: (item as PromptOrderItem).enabled }
              : item,
          )
        : value,
    ),
    ValidateBy({ name: "isPromptOrder", validator: { validate: isPromptOrder } }, { message: "Invalid promptOrder" }),
  );
}

/** Текст промпта: необязателен, не-строка (или отсутствие) — пустая строка, не ошибка. */
function IsPromptText(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value : "")),
    IsString(),
  );
}

/**
 * Тело POST/PUT /api/rp-templates. Поля и их смысл — контракт RpTemplateInput из @tg-rp-bot/shared;
 * лишние поля отсекает ValidationPipe (whitelist). У каждого поля явный дефолт: drizzle .set()
 * пропускает undefined, и PUT без поля оставил бы в БД старое значение.
 */
export class RpTemplateInputDto implements RpTemplateInput {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "Name is required" })
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @IsPromptText()
  systemPrompt = "";

  @IsPromptText()
  auxiliarySystemPrompt = "";

  @IsPromptText()
  postHistoryInstruction = "";

  @IsPromptText()
  userPersonaPrompt = "";

  // Стриминг ответа «за персону» по умолчанию включён — выключается только явным false.
  @Transform(({ value }: { value: unknown }) => value !== false)
  @IsBoolean()
  userPersonaStreaming = true;

  @IsPromptText()
  translationSystemPrompt = "";

  @IsPromptOrder()
  promptOrder!: PromptOrderItem[];
}
