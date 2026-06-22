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
import type { AnyPgColumn } from "drizzle-orm/pg-core";

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
 * image (data URL) — nullable: квадратная миниатюра (кроп, выбранный пользователем) для аватара.
 * imageFull (data URL) — nullable: то же фото целиком (уменьшенное, без кадрирования) для
 * полноэкранного просмотра; грузится отдельным запросом, чтобы список тянул только миниатюру.
 */
export const characters = pgTable("characters", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  image: text("image"),
  imageFull: text("image_full"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'`),
  // Примечание «для себя» — хранится только в UI, в LLM-запрос не передаётся (как footnote персоны).
  footnote: text("footnote"),
  prompt: text("prompt").notNull().default(""),
  // Сценарий — промпт, направляющий ИИ по ходу RP. Уходит в запрос отдельным компонентом
  // (characterScenario в promptOrder пресета). Шифруется как prompt.
  scenario: text("scenario").notNull().default(""),
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

/**
 * Персоны пользователя — личность, под которой он выступает в RP-чате.
 * footnote хранится только в UI (не передаётся в LLM).
 */
export const personas = pgTable("personas", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  image: text("image"),
  imageFull: text("image_full"),
  footnote: text("footnote"),
  prompt: text("prompt").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;

/** Компонент запроса к нейросети, чей порядок и включённость настраиваются в пресете. */
export type PromptComponentId =
  | "system"
  | "characterDescription"
  | "characterScenario"
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
  // Служебный: шаблон системной инструкции для генерации реплики от лица пользователя
  // (impersonate). Плейсхолдеры: {{char}} {{user}} {{char_prompt}} {{user_prompt}}
  // {{system_prompt}} {{aux_prompt}}; история чата уходит отдельным user-сообщением.
  userPersonaPrompt: text("user_persona_prompt").notNull().default(""),
  // Стримить ли текст при генерации реплики от лица пользователя.
  userPersonaStreaming: boolean("user_persona_streaming").notNull().default(true),
  // Служебный: системный промпт для ИИ-перевода черновика сообщения (режим «ИИ» в шторе перевода).
  // Плейсхолдер {{target_lang}} — полное англ. название целевого языка; текст уходит ролью user.
  // Пусто → дефолтный шаблон (DEFAULT_TRANSLATION_TEMPLATE в server/translate.ts).
  translationSystemPrompt: text("translation_system_prompt").notNull().default(""),

  // Рассуждение (reasoning). effort: minimal | low | medium | high | xhigh (или null).
  requestReasoning: boolean("request_reasoning").notNull().default(false),
  reasoningEffort: text("reasoning_effort"),

  // Порядок и включённость компонентов запроса. Дефолт — канонический порядок;
  // userDescription выключен (пользователь включает вручную, когда нужна персона).
  promptOrder: jsonb("prompt_order")
    .$type<PromptOrderItem[]>()
    .notNull()
    .default(
      sql`'[{"id":"system","enabled":true},{"id":"characterDescription","enabled":true},{"id":"userDescription","enabled":false},{"id":"auxiliary","enabled":true},{"id":"characterScenario","enabled":false},{"id":"history","enabled":true},{"id":"postHistory","enabled":true}]'::jsonb`,
    ),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type GenerationPreset = typeof generationPresets.$inferSelect;
export type NewGenerationPreset = typeof generationPresets.$inferInsert;

/**
 * RP-чаты: один чат = один персонаж + обязательная персона + пресет ИИ.
 * activeMessageId — «курсор» активной ветки (лист дерева сообщений).
 * Намеренно НЕ FK: chats ↔ messages образуют цикл, Drizzle/Postgres требовал бы deferrable.
 * Целостность гарантируется кодом (DAO).
 */
export const chats = pgTable("chats", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  characterId: bigint("character_id", { mode: "number" })
    .notNull()
    .references(() => characters.id),
  personaId: bigint("persona_id", { mode: "number" })
    .notNull()
    .references(() => personas.id),
  presetId: bigint("preset_id", { mode: "number" })
    .notNull()
    .references(() => generationPresets.id),
  // Пользовательское название чата (зашифровано per-user, как content сообщений).
  // null → в UI показываем имя персонажа (поведение по умолчанию).
  title: text("title"),
  activeMessageId: bigint("active_message_id", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;

/**
 * Сообщения чата в виде дерева (parentId = null → корень ветки).
 * Несколько детей одного родителя — «альтернативы»; активный путь отслеживается через
 * chats.activeMessageId (курсор на листе).
 * translations — JSON-кэш переводов: { "ru": "...", "en": "..." }.
 */
export const messages = pgTable("messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  chatId: bigint("chat_id", { mode: "number" })
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  parentId: bigint("parent_id", { mode: "number" }).references(
    (): AnyPgColumn => messages.id,
    { onDelete: "cascade" },
  ),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  translations: jsonb("translations").$type<Record<string, string>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

/**
 * Настройки перевода для конкретного чата.
 * translateScope определяет, на каких сообщениях показывать кнопку Globe:
 *   "all" = на всех, "assistant" = только ИИ-ответы, "user" = только реплики игрока.
 */
export const chatSettings = pgTable("chat_settings", {
  chatId: bigint("chat_id", { mode: "number" })
    .primaryKey()
    .references(() => chats.id, { onDelete: "cascade" }),
  translateEnabled: boolean("translate_enabled").notNull().default(false),
  translateTargetLang: text("translate_target_lang").notNull().default("ru"),
  translateScope: text("translate_scope")
    .$type<"all" | "assistant" | "user">()
    .notNull()
    .default("assistant"),
  autoTranslateScope: text("auto_translate_scope")
    .$type<"none" | "all" | "assistant" | "user">()
    .notNull()
    .default("none"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ChatSettings = typeof chatSettings.$inferSelect;
export type NewChatSettings = typeof chatSettings.$inferInsert;

/**
 * Сгенерированные ИИ варианты реплики «от лица пользователя» (impersonate).
 * Привязаны к «моменту» диалога = parentMessageId (сообщение, после которого пишется реплика,
 * = chats.activeMessageId на время генерации). parentMessageId = null → начало чата (нет родителя).
 * Каскад: вариант удаляется при удалении сообщения-момента или всего чата.
 * Не более 20 на момент — FIFO-эвикт в DAO (insertVariant).
 */
export const impersonationVariants = pgTable("impersonation_variants", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  chatId: bigint("chat_id", { mode: "number" })
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  parentMessageId: bigint("parent_message_id", { mode: "number" }).references(
    () => messages.id,
    { onDelete: "cascade" },
  ),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ImpersonationVariant = typeof impersonationVariants.$inferSelect;
export type NewImpersonationVariant = typeof impersonationVariants.$inferInsert;
