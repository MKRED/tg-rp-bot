import { MAX_CARD_CATEGORIES, type CardCategory, type CardField } from "@tg-rp-bot/shared";
import { ValidateBy } from "class-validator";
import { Transform } from "class-transformer";
import { applyDecorators } from "@nestjs/common";

/**
 * Что проверяем: категории карточки (с content, сообщения «Category N») или поля шаблона карточки
 * (без content, «Field N»). Правила остальных полей и лимиты общие — шаблон копируется в карточку.
 */
interface ItemsKind {
  noun: "Category" | "Field";
  withContent: boolean;
}

const CATEGORIES: ItemsKind = { noun: "Category", withContent: true };
const FIELDS: ItemsKind = { noun: "Field", withContent: false };

/** Первая ошибка одного элемента (порядок проверок — как в Hono-версии) или undefined. */
function itemError(raw: unknown, index: number, { noun, withContent }: ItemsKind): string | undefined {
  if (typeof raw !== "object" || raw === null) return `${noun} ${index} must be an object`;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || !c.id.trim()) return `${noun} ${index}: id is required`;
  if (typeof c.title !== "string") return `${noun} ${index}: title must be a string`;
  if (typeof c.description !== "string") return `${noun} ${index}: description must be a string`;
  if (withContent && typeof c.content !== "string") return `${noun} ${index}: content must be a string`;
  if (typeof c.enabled !== "boolean") return `${noun} ${index}: enabled must be a boolean`;
  return undefined;
}

/**
 * Первая ошибка массива или undefined. Сообщение с индексом и полем (а не общее от
 * @ValidateNested) — контракт webapp. Дубль id (после обрезки) ломает точечный мердж по id
 * (запись блока генерации на сервере, редактор полей на клиенте), поэтому тоже ошибка.
 */
function itemsError(value: unknown, kind: ItemsKind): string | undefined {
  const plural = kind.withContent ? "categories" : "fields";
  if (!Array.isArray(value)) return `${plural} must be an array`;
  if (value.length > MAX_CARD_CATEGORIES) return `Too many ${plural} (max ${MAX_CARD_CATEGORIES})`;
  const seenIds = new Set<string>();
  for (const [index, raw] of value.entries()) {
    const error = itemError(raw, index, kind);
    if (error) return error;
    const id = ((raw as Record<string, unknown>).id as string).trim();
    if (seenIds.has(id)) return `${kind.noun} ${index}: duplicate id`;
    seenIds.add(id);
  }
  return undefined;
}

/** Первая ошибка массива categories карточки или undefined. */
export const categoriesError = (value: unknown): string | undefined => itemsError(value, CATEGORIES);

/**
 * Первая ошибка массива fields шаблона или undefined. Пустой шаблон бессмыслен (карточка из него
 * получила бы дефолтную структуру — см. CardsRepository.create), поэтому хотя бы одно поле обязательно.
 */
export function fieldsError(value: unknown): string | undefined {
  const error = itemsError(value, FIELDS);
  if (error) return error;
  return (value as unknown[]).length === 0 ? "At least one field is required" : undefined;
}

/** Общая часть элемента после нормализации: обрезка id/title/description, без лишних полей. */
function normalizeField(c: Record<string, unknown>): CardField {
  return {
    id: (c.id as string).trim(),
    title: (c.title as string).trim(),
    description: (c.description as string).trim(),
    enabled: c.enabled as boolean,
  };
}

/**
 * Приводит валидный массив категорий к виду для записи: content как есть, без лишних полей — в том
 * числе pendingQuestions/askUserAnswers: состояние ask_user сервер-владеемое, репозиторий переносит
 * его из сохранённой строки. Невалидный массив не трогаем — @Transform выполняется ДО валидации, и
 * валидатор должен увидеть исходные типы, чтобы назвать ошибку.
 */
function normalizeCategories(value: unknown): unknown {
  if (categoriesError(value) !== undefined) return value;
  return (value as Record<string, unknown>[]).map(
    (c): CardCategory => ({ ...normalizeField(c), content: c.content as string }),
  );
}

/** Поля шаблона — то же, что normalizeCategories, но без content (лишнее поле отбрасывается). */
function normalizeFields(value: unknown): unknown {
  if (fieldsError(value) !== undefined) return value;
  return (value as Record<string, unknown>[]).map(normalizeField);
}

function validatedArray(name: string, normalize: (v: unknown) => unknown, error: (v: unknown) => string | undefined) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => normalize(value)),
    ValidateBy({
      name,
      validator: {
        validate: (value: unknown) => error(value) === undefined,
        defaultMessage: (args) => error(args?.value) ?? "Invalid items",
      },
    }),
  );
}

/** Массив категорий карточки: нормализация + валидация с сообщением первой ошибки (см. categoriesError). */
export function IsCardCategories(): PropertyDecorator {
  return validatedArray("isCardCategories", normalizeCategories, categoriesError);
}

/** Массив полей шаблона карточки: нормализация + валидация (см. fieldsError). */
export function IsCardFields(): PropertyDecorator {
  return validatedArray("isCardFields", normalizeFields, fieldsError);
}
