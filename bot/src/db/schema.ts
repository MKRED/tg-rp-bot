import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
