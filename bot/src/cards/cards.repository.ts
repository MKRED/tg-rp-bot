import { Injectable } from "@nestjs/common";
import {
  DEFAULT_CARD_CATEGORIES,
  DEFAULT_CARD_PROMPT,
  DEFAULT_CARD_SYSTEM_PROMPT,
  type AskUserAnswer,
  type AskUserQuestion,
  type CardCategory,
  type CardInput,
} from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "../db/index.js";
import type { Card } from "../db/schema.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../utils/index.js";
import { decryptCategories, encryptCategories } from "./card-crypto.js";

/** Строка списка, как её отдаёт БД (Date) — сервис сериализует в контракт CardListItem. */
export interface CardListRow {
  id: number;
  name: string;
  updatedAt: Date;
}

/** Патч одной категории внутри точечной записи (см. patchCategory). */
type CategoryPatch = (category: CardCategory) => CardCategory;

/**
 * Доступ к таблице cards. Все запросы ограничены владельцем (user_id); systemPrompt, prompt и
 * текстовые поля категорий шифруются per-user ключом на записи и расшифровываются на чтении.
 */
@Injectable()
export class CardsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Список карточек пользователя — свежие сверху. */
  async list(userId: number): Promise<CardListRow[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ id: schema.cards.id, name: schema.cards.name, updatedAt: schema.cards.updatedAt })
      .from(schema.cards)
      .where(eq(schema.cards.userId, userId))
      .orderBy(desc(schema.cards.updatedAt));
    logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Cards listed");
    return rows;
  }

  /** Сколько карточек у пользователя (для проверки мягкого лимита). */
  async count(userId: number): Promise<number> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.cards)
      .where(eq(schema.cards.userId, userId));
    const count = rows[0]?.count ?? 0;
    logger.debug({ durationMs: Date.now() - t0, userId, count }, "Cards counted");
    return count;
  }

  /** Полная карточка по id, только если она принадлежит этому пользователю (расшифрована). */
  async findOne(userId: number, id: number): Promise<Card | undefined> {
    const rows = await this.database.db
      .select()
      .from(schema.cards)
      .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)));
    const row = rows[0];
    return row ? decryptRow(row, userId) : undefined;
  }

  /**
   * Создаёт карточку. Пустые systemPrompt/prompt/categories (новая карточка без явных значений)
   * заменяются дефолтами здесь, а не DB default колонки: текст шифруется per-user.
   */
  async create(userId: number, input: CardInput): Promise<Card> {
    const t0 = Date.now();
    const key = getUserEncryptionKey(userId);
    const rows = await this.database.db
      .insert(schema.cards)
      .values({
        userId,
        name: input.name,
        systemPrompt: encryptField(input.systemPrompt.trim() || DEFAULT_CARD_SYSTEM_PROMPT, key),
        prompt: encryptField(input.prompt.trim() || DEFAULT_CARD_PROMPT, key),
        categories: encryptCategories(input.categories.length > 0 ? input.categories : DEFAULT_CARD_CATEGORIES, key),
        presetId: input.presetId,
        useWebSearch: input.useWebSearch,
        useAskUser: input.useAskUser,
      })
      .returning();
    const created = rows[0]!;
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Card created");
    return decryptRow(created, userId);
  }

  /**
   * Обновляет карточку из формы (только свою); undefined — карточки нет. pendingQuestions/
   * askUserAnswers сервер-владеемые: клиент их не присылает (DTO отсекает), а полная перезапись
   * categories без подмешивания стёрла бы их при любом сохранении формы — переносим из текущей
   * строки по id категории.
   */
  async update(userId: number, id: number, input: CardInput): Promise<Card | undefined> {
    const existing = await this.findOne(userId, id);
    if (!existing) return undefined;
    const existingById = new Map(existing.categories.map((c) => [c.id, c]));
    const categories = input.categories.map((c) => ({
      ...c,
      pendingQuestions: existingById.get(c.id)?.pendingQuestions,
      askUserAnswers: existingById.get(c.id)?.askUserAnswers,
    }));
    return this.persist(userId, id, { ...input, categories });
  }

  /** Удаляет карточку (только свою). true — строка была удалена. */
  async delete(userId: number, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.cards)
      .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)))
      .returning({ id: schema.cards.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Card delete attempted");
    return deleted;
  }

  /**
   * Сохраняет сгенерированный текст одной категории. pendingQuestions сбрасывается: content
   * появляется, только когда генерация завершена, а оставшиеся вопросы (клиент не увидел паузу —
   * потерял сеть) навсегда перекрывали бы готовый блок каруселью в интерфейсе.
   */
  setCategoryContent(userId: number, id: number, categoryId: string, content: string): Promise<Card | undefined> {
    return this.patchCategory(userId, id, categoryId, (c) => ({ ...c, content, pendingQuestions: undefined }));
  }

  /** Записывает вопросы ask_user, ждущие ответа (генерация блока приостановлена до ответа). */
  setCategoryPendingQuestions(
    userId: number,
    id: number,
    categoryId: string,
    questions: AskUserQuestion[],
  ): Promise<Card | undefined> {
    return this.patchCategory(userId, id, categoryId, (c) => ({ ...c, pendingQuestions: questions }));
  }

  /**
   * Сбрасывает накопленные askUserAnswers категории — только явная «Перегенерировать»: иначе ответы
   * для заменяемого варианта блока реплеились бы в промпт вечно и занимали бы бюджет
   * ASK_USER_MAX_ANSWERED_QUESTIONS. Ответ на паузу ask_user сюда не заходит — там ответы копятся.
   */
  clearCategoryAskUserAnswers(userId: number, id: number, categoryId: string): Promise<Card | undefined> {
    return this.patchCategory(userId, id, categoryId, (c) => ({ ...c, askUserAnswers: undefined }));
  }

  /** Дописывает ответы (или отказ) ask_user в историю категории и снимает pendingQuestions. */
  applyCategoryAnswers(
    userId: number,
    id: number,
    categoryId: string,
    answers: AskUserAnswer[],
  ): Promise<Card | undefined> {
    return this.patchCategory(userId, id, categoryId, (c) => ({
      ...c,
      pendingQuestions: undefined,
      askUserAnswers: [...(c.askUserAnswers ?? []), ...answers],
    }));
  }

  /**
   * Точечная запись одной категории: drizzle/jsonb не умеет патчить поле вложенного элемента, поэтому
   * read-modify-write всей строки — от гонки с PUT защищает cardLock (card-lock.ts) у вызывающих.
   */
  private async patchCategory(
    userId: number,
    id: number,
    categoryId: string,
    patch: CategoryPatch,
  ): Promise<Card | undefined> {
    const card = await this.findOne(userId, id);
    if (!card) return undefined;
    const categories = card.categories.map((c) => (c.id === categoryId ? patch(c) : c));
    return this.persist(userId, id, { ...cardToInput(card), categories });
  }

  /**
   * Пишет карточку как есть: categories уже должны содержать актуальное состояние ask_user. Пустой
   * systemPrompt заменяется дефолтом (как на вставке) — иначе контракт поблочной генерации исчез бы;
   * пустой prompt пишется как есть.
   */
  private async persist(userId: number, id: number, input: CardInput): Promise<Card | undefined> {
    const t0 = Date.now();
    const key = getUserEncryptionKey(userId);
    const rows = await this.database.db
      .update(schema.cards)
      .set({
        name: input.name,
        systemPrompt: encryptField(input.systemPrompt.trim() || DEFAULT_CARD_SYSTEM_PROMPT, key),
        prompt: encryptField(input.prompt, key),
        categories: encryptCategories(input.categories, key),
        presetId: input.presetId,
        useWebSearch: input.useWebSearch,
        useAskUser: input.useAskUser,
      })
      .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)))
      .returning();
    const updated = rows[0];
    logger.info({ durationMs: Date.now() - t0, userId, id, found: Boolean(updated) }, "Card update attempted");
    return updated ? decryptRow(updated, userId) : undefined;
  }
}

/**
 * Расшифровывает строку карточки для владельца. systemPrompt — фолбэк на дефолт: у карточек,
 * созданных до появления поля, в колонке пустая строка (миграция не может подставить per-user
 * шифротекст), и без фолбэка они уходили бы на генерацию с пустым system-сообщением.
 */
function decryptRow(row: Card, userId: number): Card {
  const key = getUserEncryptionKey(userId);
  return {
    ...row,
    systemPrompt: decryptField(row.systemPrompt, key) || DEFAULT_CARD_SYSTEM_PROMPT,
    prompt: decryptField(row.prompt, key),
    categories: decryptCategories(row.categories, key),
  };
}

/** Поля формы из уже расшифрованной карточки — для полной перезаписи в точечных операциях. */
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
