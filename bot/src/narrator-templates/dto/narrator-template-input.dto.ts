import { applyDecorators } from "@nestjs/common";
import {
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_TRANSLATION_REASONING_EFFORT,
  MAX_NARRATOR_TEMPLATE_NAME_CHARS,
  TRANSLATION_REASONING_LEVELS,
  type NarratorTemplateInput,
  type StoryPromptOrderItem,
  type TranslationReasoningLevel,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsString } from "class-validator";
import { normalizeStoryPromptOrder } from "../../prompt/storyPromptOrder.js";

const trimmed = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

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
 * Маркер сборки narrator-запроса — обязателен: это не текст промпта с фолбэком на дефолт, а часть
 * механики storyPromptBuilder (нейтрализация отыгранных ходов / leading-user), пустая строка её сломала бы.
 */
function IsMarker(message: string): PropertyDecorator {
  return applyDecorators(Transform(trimmed), IsString({ message }), IsNotEmpty({ message }));
}

const defaultPromptOrder = (): StoryPromptOrderItem[] => DEFAULT_NARRATOR_PROMPT_ORDER.map((item) => ({ ...item }));

/**
 * Тело POST/PUT /api/narrator-templates. Поля и их смысл — контракт NarratorTemplateInput из
 * @tg-rp-bot/shared; лишние поля отсекает ValidationPipe (whitelist). У каждого поля явный дефолт:
 * drizzle .set() пропускает undefined, и PUT без поля оставил бы в БД старое значение.
 */
export class NarratorTemplateInputDto implements NarratorTemplateInput {
  // Слишком длинное название не ошибка — молча усекается (как в Hono-версии).
  @Transform(({ value }) => (typeof value === "string" ? value.trim().slice(0, MAX_NARRATOR_TEMPLATE_NAME_CHARS) : value))
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
  translationSystemPrompt = "";

  @IsPromptText()
  compactionPrompt = "";

  @IsMarker("Continue marker is required")
  continueMarker!: string;

  @IsMarker("Leading user marker is required")
  leadingUserMarker!: string;

  // Порядок не валидируется, а нормализуется к каноническому набору: недостающие компоненты
  // дописываются (старые шаблоны без compact), неизвестные/дубли отбрасываются — без 400.
  @Transform(({ value }: { value: unknown }) => normalizeStoryPromptOrder(value))
  @IsArray()
  promptOrder: StoryPromptOrderItem[] = defaultPromptOrder();

  @IsFlag()
  mergeSystemPrompts = false;

  // Отсутствие — дефолт; присланное значение (включая null) обязано быть допустимым уровнем.
  @IsIn(TRANSLATION_REASONING_LEVELS, { message: "Invalid translationReasoningEffort" })
  translationReasoningEffort: TranslationReasoningLevel = DEFAULT_TRANSLATION_REASONING_EFFORT;

  @IsFlag()
  translatePerParagraph = false;
}
