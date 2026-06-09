import { sql } from "drizzle-orm";
import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Пользователи бота. id — это Telegram user id (помещается в безопасный диапазон integer).
 * Стартовая таблица: задаёт паттерн миграций, дальше расширяем под RP-сущности.
 */
export const users = pgTable("users", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  languageCode: text("language_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * RP-персонажи, созданные пользователем. Базовый набор полей расширяемый — поэтому
 * варианты первого сообщения держим в jsonb (форма элемента ещё будет меняться), а теги
 * в text[] (плоские, вероятная ось будущей фильтрации по БД).
 *
 * id — собственный identity-ключ (в отличие от users.id, который равен Telegram id):
 * персонаж адресуется только за стеной initData, непредсказуемость не нужна.
 * image (data URL) — nullable: колонка под будущий UI загрузки, в этой итерации не заполняется.
 */
export const characters = pgTable("characters", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  image: text("image"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'`),
  prompt: text("prompt").notNull().default(""),
  firstMessages: jsonb("first_messages")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
