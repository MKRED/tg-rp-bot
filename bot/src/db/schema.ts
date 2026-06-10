import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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

/** Компонент запроса к нейросети, чей порядок и включённость настраиваются в пресете. */
export type PromptComponentId =
  | "system"
  | "characterDescription"
  | "userDescription"
  | "auxiliary"
  | "history"
  | "postHistory";

/** Элемент порядка промптов: какой компонент и включён ли он в запрос. */
export type PromptOrderItem = { id: PromptComponentId; enabled: boolean };

/**
 * Пресеты настроек генерации («Настройки ответа ИИ»). Один пользователь — много пресетов,
 * описывающих, КАК нейросеть отвечает (сэмплинг, лимиты токенов, системные промпты, порядок их
 * подстановки в запрос). Реальная генерация пока не подключена — это хранилище под будущий
 * вызов OpenRouter; имена полей подобраны под прямой маппинг в его API.
 *
 * Параметры сэмплинга — nullable: null означает «не передавать значение» (провайдер применит
 * своё). Важно, что null ≠ 0, иначе temperature:0 / presencePenalty:0 нельзя было бы отличить
 * от «выключено». promptOrder — jsonb: набор компонентов расширяемый, переживёт без миграции типа.
 */
export const generationPresets = pgTable("generation_presets", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),

  // Лимиты токенов (не сэмплинг). contextUnlimited скрывает contextSize в UI.
  contextUnlimited: boolean("context_unlimited").notNull().default(false),
  contextSize: integer("context_size"),
  maxTokens: integer("max_tokens"),
  streaming: boolean("streaming").notNull().default(false),

  // Параметры сэмплинга — nullable (null = не передавать).
  temperature: real("temperature"),
  topP: real("top_p"),
  topK: integer("top_k"),
  frequencyPenalty: real("frequency_penalty"),
  presencePenalty: real("presence_penalty"),
  repetitionPenalty: real("repetition_penalty"),
  minP: real("min_p"),
  topA: real("top_a"),

  // Промпты.
  systemPrompt: text("system_prompt").notNull().default(""),
  auxiliarySystemPrompt: text("auxiliary_system_prompt").notNull().default(""),
  postHistoryInstruction: text("post_history_instruction").notNull().default(""),
  // Служебный: генерация ответа от лица пользователя.
  userPersonaPrompt: text("user_persona_prompt").notNull().default(""),

  // Рассуждение (reasoning). effort: minimal | low | medium | high | xhigh (или null).
  requestReasoning: boolean("request_reasoning").notNull().default(false),
  reasoningEffort: text("reasoning_effort"),

  // Порядок и включённость компонентов запроса. Дефолт — канонический порядок;
  // userDescription выключен (компонент ещё не реализован).
  promptOrder: jsonb("prompt_order")
    .$type<PromptOrderItem[]>()
    .notNull()
    .default(
      sql`'[{"id":"system","enabled":true},{"id":"characterDescription","enabled":true},{"id":"userDescription","enabled":false},{"id":"auxiliary","enabled":true},{"id":"history","enabled":true},{"id":"postHistory","enabled":true}]'::jsonb`,
    ),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type GenerationPreset = typeof generationPresets.$inferSelect;
export type NewGenerationPreset = typeof generationPresets.$inferInsert;
