import { MAX_CARD_CATEGORIES, type CardCategory } from "@tg-rp-bot/shared";
import { ValidateBy } from "class-validator";
import { Transform } from "class-transformer";
import { applyDecorators } from "@nestjs/common";

/** Первая ошибка одного элемента categories (порядок проверок — как в Hono-версии) или undefined. */
function categoryError(raw: unknown, index: number): string | undefined {
  if (typeof raw !== "object" || raw === null) return `Category ${index} must be an object`;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || !c.id.trim()) return `Category ${index}: id is required`;
  if (typeof c.title !== "string") return `Category ${index}: title must be a string`;
  if (typeof c.description !== "string") return `Category ${index}: description must be a string`;
  if (typeof c.content !== "string") return `Category ${index}: content must be a string`;
  if (typeof c.enabled !== "boolean") return `Category ${index}: enabled must be a boolean`;
  return undefined;
}

/**
 * Первая ошибка массива categories или undefined. Сообщение с индексом и полем (а не общее от
 * @ValidateNested) — контракт webapp. Дубль id (после обрезки) ломает точечный мердж по id
 * (запись блока генерации на сервере, CategoryList на клиенте), поэтому тоже ошибка.
 */
export function categoriesError(value: unknown): string | undefined {
  if (!Array.isArray(value)) return "categories must be an array";
  if (value.length > MAX_CARD_CATEGORIES) return `Too many categories (max ${MAX_CARD_CATEGORIES})`;
  const seenIds = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const error = categoryError(raw, index);
    if (error) return error;
    const id = ((raw as Record<string, unknown>).id as string).trim();
    if (seenIds.has(id)) return `Category ${index}: duplicate id`;
    seenIds.add(id);
  }
  return undefined;
}

/**
 * Приводит валидный массив к виду для записи: обрезка id/title/description, content как есть, без
 * лишних полей — в том числе pendingQuestions/askUserAnswers: состояние ask_user сервер-владеемое,
 * репозиторий переносит его из сохранённой строки. Невалидный массив не трогаем — @Transform
 * выполняется ДО валидации, и валидатор должен увидеть исходные типы, чтобы назвать ошибку.
 */
function normalizeCategories(value: unknown): unknown {
  if (categoriesError(value) !== undefined) return value;
  return (value as Record<string, unknown>[]).map(
    (c): CardCategory => ({
      id: (c.id as string).trim(),
      title: (c.title as string).trim(),
      description: (c.description as string).trim(),
      content: c.content as string,
      enabled: c.enabled as boolean,
    }),
  );
}

/** Массив категорий карточки: нормализация + валидация с сообщением первой ошибки (см. categoriesError). */
export function IsCardCategories(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => normalizeCategories(value)),
    ValidateBy({
      name: "isCardCategories",
      validator: {
        validate: (value: unknown) => categoriesError(value) === undefined,
        defaultMessage: (args) => categoriesError(args?.value) ?? "Invalid categories",
      },
    }),
  );
}
