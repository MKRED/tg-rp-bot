import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { AskUserAnswer, AskUserQuestion, Card, CardCategory } from "../schema.js";
import {
  DEFAULT_CARD_CATEGORIES,
  DEFAULT_CARD_PROMPT,
  DEFAULT_CARD_SYSTEM_PROMPT,
} from "./cards.constants.js";
import type { CardInput, CardListItem } from "./types.js";

export { ensureUser } from "../users.js";

/** Шифрует текстовые поля категорий (title/description/content + ask_user question/answer/options),
 * id/enabled — как есть. */
function encryptCategories(categories: CardCategory[], key: Buffer): CardCategory[] {
  return categories.map((c) => ({
    ...c,
    title: encryptField(c.title, key),
    description: encryptField(c.description, key),
    content: encryptField(c.content, key),
    pendingQuestions: c.pendingQuestions?.map((q) => ({
      question: encryptField(q.question, key),
      options: q.options?.map((o) => encryptField(o, key)),
    })),
    askUserAnswers: c.askUserAnswers?.map((a) => ({
      question: encryptField(a.question, key),
      answer: encryptField(a.answer, key),
      options: a.options?.map((o) => encryptField(o, key)),
    })),
  }));
}

/** Расшифровывает текстовые поля категорий — обратная операция encryptCategories. */
function decryptCategories(categories: CardCategory[], key: Buffer): CardCategory[] {
  return categories.map((c) => ({
    ...c,
    title: decryptField(c.title, key),
    description: decryptField(c.description, key),
    content: decryptField(c.content, key),
    pendingQuestions: c.pendingQuestions?.map((q) => ({
      question: decryptField(q.question, key),
      options: q.options?.map((o) => decryptField(o, key)),
    })),
    askUserAnswers: c.askUserAnswers?.map((a) => ({
      question: decryptField(a.question, key),
      answer: decryptField(a.answer, key),
      options: a.options?.map((o) => decryptField(o, key)),
    })),
  }));
}

/**
 * Расшифровывает systemPrompt, prompt и категории строки карточки для её владельца.
 * systemPrompt — фоллбэк на дефолт: у карточек, созданных до появления этого поля, в колонке
 * пустая строка (миграция не может подставить осмысленный per-user шифротекст), без фоллбэка
 * они молча уходили бы на генерацию с пустым system-сообщением — контракт поблочной генерации
 * (формат ответа, что <example> лишь образец) исчезал бы целиком.
 */
function decryptCardRow(row: Card, userId: number): Card {
  const key = getUserEncryptionKey(userId);
  return {
    ...row,
    systemPrompt: decryptField(row.systemPrompt, key) || DEFAULT_CARD_SYSTEM_PROMPT,
    prompt: decryptField(row.prompt, key),
    categories: decryptCategories(row.categories, key),
  };
}

/** Список карточек пользователя — свежие сверху. */
export async function listCards(userId: number): Promise<CardListItem[]> {
  const t0 = Date.now();
  const rows = await db
    .select({
      id: schema.cards.id,
      name: schema.cards.name,
      updatedAt: schema.cards.updatedAt,
    })
    .from(schema.cards)
    .where(eq(schema.cards.userId, userId))
    .orderBy(desc(schema.cards.updatedAt));
  logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Cards listed");
  return rows;
}

/** Сколько карточек у пользователя (для проверки мягкого лимита). */
export async function countCards(userId: number): Promise<number> {
  const t0 = Date.now();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.cards)
    .where(eq(schema.cards.userId, userId));
  const count = rows[0]?.count ?? 0;
  logger.debug({ durationMs: Date.now() - t0, userId, count }, "Cards counted");
  return count;
}

/** Полная карточка по id, только если она принадлежит этому пользователю (расшифрована). */
export async function getCard(userId: number, id: number): Promise<Card | undefined> {
  const rows = await db
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)));
  const row = rows[0];
  return row ? decryptCardRow(row, userId) : undefined;
}

/**
 * Создаёт карточку и возвращает созданную строку (расшифрованную).
 * Пустой prompt/categories от клиента (новая карточка ещё без явных значений) заменяются
 * дефолтной структурой — раньше это было бы DB default колонки, но текст шифруется per-user,
 * поэтому дефолт применяется здесь, на вставке.
 */
export async function createCard(userId: number, input: CardInput): Promise<Card> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  const systemPrompt = input.systemPrompt.trim() || DEFAULT_CARD_SYSTEM_PROMPT;
  const prompt = input.prompt.trim() || DEFAULT_CARD_PROMPT;
  const categories = input.categories.length > 0 ? input.categories : DEFAULT_CARD_CATEGORIES;
  const rows = await db
    .insert(schema.cards)
    .values({
      userId,
      name: input.name,
      systemPrompt: encryptField(systemPrompt, key),
      prompt: encryptField(prompt, key),
      categories: encryptCategories(categories, key),
      presetId: input.presetId,
      useWebSearch: input.useWebSearch,
      useAskUser: input.useAskUser,
    })
    .returning();
  const created = rows[0]!;
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Card created");
  return decryptCardRow(created, userId);
}

/** Собирает CardInput из уже расшифрованной строки — для точечных операций ниже, которым нужно
 * перезаписать карточку целиком (drizzle/jsonb не поддерживает патч одного поля вложенного элемента). */
function cardToInput(card: Card): CardInput {
  return {
    name: card.name,
    systemPrompt: card.systemPrompt,
    prompt: card.prompt,
    categories: card.categories,
    presetId: card.presetId,
    useWebSearch: card.useWebSearch,
    useAskUser: card.useAskUser,
  };
}

/**
 * Пишет карточку как есть, без подмешивания состояния ask_user — вызывающий обязан сам передать уже
 * корректный (актуальный) массив categories, включая pendingQuestions/askUserAnswers, если они должны
 * сохраниться. Используется точечными операциями ниже, которые держат карточку в руках и меняют одно
 * поле одной категории — updateCard (принимает вход из клиента, который эти поля не знает) строит
 * безопасный массив сам и делегирует сюда.
 */
async function persistCard(userId: number, id: number, input: CardInput): Promise<Card | undefined> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  // Тот же фоллбэк, что в createCard: пустой systemPrompt (например, из CardForm у карточки,
  // у которой это поле ещё не заполнено) не должен затирать контракт поблочной генерации пустотой.
  const systemPrompt = input.systemPrompt.trim() || DEFAULT_CARD_SYSTEM_PROMPT;
  const rows = await db
    .update(schema.cards)
    .set({
      name: input.name,
      systemPrompt: encryptField(systemPrompt, key),
      prompt: encryptField(input.prompt, key),
      categories: encryptCategories(input.categories, key),
      presetId: input.presetId,
      useWebSearch: input.useWebSearch,
      useAskUser: input.useAskUser,
    })
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "Card update attempted",
  );
  return updated ? decryptCardRow(updated, userId) : undefined;
}

/**
 * Обновляет карточку из клиентского input (форма Mini App, только своя). Возвращает обновлённую
 * строку (расшифрованную) или undefined, если карточки с таким id у пользователя нет.
 *
 * pendingQuestions/askUserAnswers — состояние ask_user (см. schema.types.ts) сервер-владеемое:
 * клиент никогда не присылает их (parseCardInput их не читает), а полная перезапись input.categories
 * без подмешивания стёрла бы их при любом обычном сохранении формы. Поэтому здесь всегда читаем
 * текущую строку и переносим оба поля из неё по id категории, что бы ни пришло во входе.
 */
export async function updateCard(
  userId: number,
  id: number,
  input: CardInput,
): Promise<Card | undefined> {
  const existing = await getCard(userId, id);
  if (!existing) return undefined;
  const existingById = new Map(existing.categories.map((c) => [c.id, c]));
  const categories = input.categories.map((c) => ({
    ...c,
    pendingQuestions: existingById.get(c.id)?.pendingQuestions,
    askUserAnswers: existingById.get(c.id)?.askUserAnswers,
  }));
  return persistCard(userId, id, { ...input, categories });
}

/** Удаляет карточку (только свою). true — если строка была удалена. */
export async function deleteCard(userId: number, id: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)))
    .returning({ id: schema.cards.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Card delete attempted");
  return deleted;
}

/**
 * Сохраняет сгенерированный/отредактированный текст одной категории (только своя карточка).
 * Возвращает обновлённую (расшифрованную) карточку или undefined, если карточка не найдена.
 * Точечная запись вместо полного updateCard — используется хендлером генерации блока, где
 * меняется только content одной категории, а не вся форма.
 *
 * pendingQuestions сбрасывается явно: content появляется, только когда генерация ЗАВЕРШЕНА (в т.ч.
 * после ответа на ask_user — см. answerQuestions.ts), а без сброса случайно оставшиеся вопросы
 * (клиент не увидел ответ на паузу — потерял сеть/вкладку, и следующий вызов уже прошёл без
 * уточнения) навсегда перекрывали бы готовый блок каруселью в интерфейсе.
 */
export async function setCardCategoryContent(
  userId: number,
  id: number,
  categoryId: string,
  content: string,
): Promise<Card | undefined> {
  const card = await getCard(userId, id);
  if (!card) return undefined;
  const categories = card.categories.map((c) =>
    c.id === categoryId ? { ...c, content, pendingQuestions: undefined } : c,
  );
  return persistCard(userId, id, { ...cardToInput(card), categories });
}

/**
 * Записывает вопросы ask_user, ожидающие ответа для одной категории (генерация блока приостановлена
 * до ответа пользователя — см. server/cards/generation/generateBlock.ts). Точечная запись, как
 * setCardCategoryContent.
 */
export async function setCardCategoryPendingQuestions(
  userId: number,
  id: number,
  categoryId: string,
  questions: AskUserQuestion[],
): Promise<Card | undefined> {
  const card = await getCard(userId, id);
  if (!card) return undefined;
  const categories = card.categories.map((c) => (c.id === categoryId ? { ...c, pendingQuestions: questions } : c));
  return persistCard(userId, id, { ...cardToInput(card), categories });
}

/**
 * Сбрасывает накопленные askUserAnswers одной категории — используется явной «Перегенерировать»
 * (см. server/cards/generation/generateBlock.ts, resetAskUserAnswers), а не резюмированием паузы
 * ask_user: без сброса ответы, собранные для СТАРОГО (уже заменяемого) варианта блока, реплеились
 * бы в промпт вечно при каждой последующей перегенерации этого же блока (см. promptAssembly.ts) —
 * и так же вечно занимали бы бюджет ASK_USER_MAX_ANSWERED_QUESTIONS, который иначе никогда не
 * освобождается. Явный ответ пользователя на паузу (answerQuestions.ts) сюда не заходит — там
 * ответы, наоборот, должны накапливаться в рамках ОДНОЙ попытки генерации.
 */
export async function clearCardCategoryAskUserAnswers(
  userId: number,
  id: number,
  categoryId: string,
): Promise<Card | undefined> {
  const card = await getCard(userId, id);
  if (!card) return undefined;
  const categories = card.categories.map((c) => (c.id === categoryId ? { ...c, askUserAnswers: undefined } : c));
  return persistCard(userId, id, { ...cardToInput(card), categories });
}

/**
 * Дописывает ответы (или отказ) на вопросы ask_user одной категории в её накопленную историю и
 * снимает pendingQuestions — см. server/cards/generation/answerQuestions.ts, которая после этого
 * заново запускает генерацию блока с уже известными ответами в контексте.
 */
export async function applyCardCategoryAnswers(
  userId: number,
  id: number,
  categoryId: string,
  answers: AskUserAnswer[],
): Promise<Card | undefined> {
  const card = await getCard(userId, id);
  if (!card) return undefined;
  const categories = card.categories.map((c) =>
    c.id === categoryId
      ? { ...c, pendingQuestions: undefined, askUserAnswers: [...(c.askUserAnswers ?? []), ...answers] }
      : c,
  );
  return persistCard(userId, id, { ...cardToInput(card), categories });
}
