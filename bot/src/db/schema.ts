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
import type { CardCategory, PromptOrderItem, StoryPromptOrderItem } from "./schema.types.js";

// Типы компонентов промптов живут в schema.types.ts; реэкспорт сохраняет прежнюю точку
// импорта `db/schema.js` для пресетов, narrator-шаблонов и билдеров промптов.
export type {
  CardCategory,
  PromptComponentId,
  PromptOrderItem,
  StoryPromptComponentId,
  StoryPromptOrderItem,
} from "./schema.types.js";

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
 * Пользовательские настройки (одна строка на пользователя). Заведено под отладку LLM-перехвата,
 * но намеренно сделано общей таблицей настроек — сюда добавляются будущие per-user предпочтения
 * без новой таблицы под каждое поле.
 *
 * llmDebugEnabled — писать ли RAW-лог запросов к LLM (тумблер на экране отладки). Дефолт true —
 *   осознанный выбор: перехват это escape-hatch, экран не должен быть пустым на момент бага
 *   (записи живут только в памяти процесса, на диск/в БД не пишутся, см. llm/debugCapture.ts).
 * llmDebugMaxRequests — сколько последних запросов держать в кольце перехвата.
 * llmDebugHeadMessages / llmDebugTailMessages — сколько сообщений messages[] показывать с краёв
 *   (усечение середины — только на клиенте). В БД, а не в localStorage, чтобы значения были
 *   одинаковыми на всех устройствах пользователя.
 */
export const userSettings = pgTable("user_settings", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  llmDebugEnabled: boolean("llm_debug_enabled").notNull().default(true),
  llmDebugMaxRequests: integer("llm_debug_max_requests").notNull().default(30),
  llmDebugHeadMessages: integer("llm_debug_head_messages").notNull().default(3),
  llmDebugTailMessages: integer("llm_debug_tail_messages").notNull().default(5),
  // Персональный ключ DeepSeek (BYOK — общего ключа из env больше нет). Зашифрован encryptField
  // (см. utils/crypto.ts), NULL = ключ не задан → генерация падает с MissingApiKeyError.
  deepseekApiKey: text("deepseek_api_key"),
  // Id модели DeepSeek (из GET /models), выбранной пользователем. NULL → используется
  // DEFAULT_DEEPSEEK_MODEL (см. llm/resolveProvider.ts), если ключ уже задан.
  deepseekModel: text("deepseek_model"),
  // Персональный ключ Tavily (веб-поиск, BYOK). Зашифрован encryptField (см. utils/crypto.ts),
  // NULL = ключ не задан. Квота не кэшируется в БД — запрашивается у Tavily "на лету" (GET /usage).
  tavilyApiKey: text("tavily_api_key"),
  // Максимум раундов tool-calling (запрос модели → web_search → результат) подряд за одну
  // генерацию с включённым веб-поиском (см. tavily/searchSettings.ts). Жёсткий серверный лимит:
  // после его достижения модель получает финальный раунд без инструмента tools и обязана
  // ответить тем, что успела найти, а не просьбой к пользователю.
  tavilyMaxSearchRounds: integer("tavily_max_search_rounds").notNull().default(4),
  // Настройки режима перевода в PromptEditorOverlay (полноэкранный редактор промпт-полей —
  // персонажи/персоны/карточки/пресеты/шаблоны). НЕ путать с template-scoped
  // rpTemplates/narratorTemplates.translationSystemPrompt — та фича отдельная (Globe-кнопка
  // RP-чата), префикс promptTranslate* здесь маркирует другой, безэнтитный контекст.
  promptTranslateEngine: text("prompt_translate_engine").$type<"google" | "ai">().notNull().default("google"),
  promptTranslateTargetLang: text("prompt_translate_target_lang").notNull().default("en"),
  // Свой системный промпт ИИ-перевода (плейсхолдер {{target_lang}}). NULL/пусто → DEFAULT_TRANSLATION_TEMPLATE.
  promptTranslateSystemPrompt: text("prompt_translate_system_prompt"),
  // "off" — без рассуждения (дефолт: пер-абзацных вызовов может быть много за одно действие
  // пользователя, платить thinking-токены за каждый — дорого и медленно для того, что должно
  // ощущаться мгновенным во время редактирования промпта); иначе — уровень effort.
  promptTranslateReasoningEffort: text("prompt_translate_reasoning_effort").notNull().default("off"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

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
  // (characterScenario в promptOrder RP-шаблона). Шифруется как prompt.
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

/**
 * Карточки — черновики персонажей/персон в «Мастерской» (`/cards`), отдельная сущность от
 * `characters`/`personas`: не участвует в RP-чате/narrator и ни на что не ссылается. Карточку
 * доводят через ИИ-генерацию до готовой и выгружают в персонажа/персону — конвертация реализована
 * только на уровне webapp (сборка промпта + вызов существующих POST /api/characters и
 * /api/personas), без FK/tracking происхождения в этой схеме — сознательно: `characters`/`personas`
 * не хранят, из какой карточки созданы. Схема растёт миграциями по мере готовности этапов формы.
 *
 * systemPrompt — system-роль в сборке генерации (см. assembleCardBlockPrompt): инструкции ИИ о
 * формате ответа и поблочной генерации (что <example> в первом user-сообщении — только образец
 * структуры, а не готовый ответ). Редактируется пользователем, не зависит от конкретного персонажа.
 * prompt — основной промпт карточки (что за персонаж, вводные для ИИ), уходит user-сообщением;
 * может содержать плейсхолдер {{example}} — на его место при сборке вставляется <example>-блок,
 * собранный из enabled-категорий (title+description); если плейсхолдера нет, блок дописывается в конец.
 * categories — редактируемая пользователем структура карточки (см. CardCategory в schema.types.ts):
 * порядок элементов массива = порядок генерации/сборки промпта. content каждой категории — либо
 * ИИ-сгенерированный, либо отредактированный вручную текст блока (пусто = блок ещё не сгенерирован).
 * presetId — пресет сэмплинга для генерации блоков (generation_presets, как у RP-чата/narrator);
 * nullable — карточка существует до того, как пресет выбран, эндпоинт генерации требует его явно.
 * FK без onDelete (= restrict): пресет, используемый карточкой, нельзя удалить (23503 → 409 in_use,
 * как у chats/story_chats).
 * systemPrompt, prompt и текстовые поля categories (title/description/content) шифруются per-user
 * в DAO, как prompt/footnote у characters.
 */
export const cards = pgTable("cards", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull().default(""),
  prompt: text("prompt").notNull().default(""),
  categories: jsonb("categories").$type<CardCategory[]>().notNull().default(sql`'[]'::jsonb`),
  presetId: bigint("preset_id", { mode: "number" }).references(() => generationPresets.id),
  // Веб-поиск (Tavily, BYOK) при генерации блоков этой карточки: модель сама решает,
  // когда звать web_search (tool_choice: "auto"), в пределах user_settings.tavilyMaxSearchRounds.
  // Действует, только если у пользователя сохранён ключ Tavily (см. generateBlock.ts) — иначе
  // тихо генерирует без поиска, тумблер в форме мог остаться включённым после удаления ключа.
  useWebSearch: boolean("use_web_search").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;

/**
 * Пресеты настроек генерации («Настройки ответа ИИ»). Один пользователь — много пресетов,
 * описывающих, КАК нейросеть сэмплирует ответ (сэмплинг, лимиты токенов, reasoning). Режимо-
 * независим — общий для RP-чата и narrator (промпты живут отдельно: у RP-чата — в rp_templates,
 * у narrator — в narrator_templates). Имена полей подобраны под прямой маппинг в API OpenRouter.
 *
 * Параметры сэмплинга — nullable: null означает «не передавать значение» (провайдер применит
 * своё). Важно, что null ≠ 0, иначе temperature:0 / presencePenalty:0 нельзя было бы отличить
 * от «выключено».
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

  // Рассуждение (reasoning). effort: minimal | low | medium | high | xhigh (или null).
  requestReasoning: boolean("request_reasoning").notNull().default(false),
  reasoningEffort: text("reasoning_effort"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type GenerationPreset = typeof generationPresets.$inferSelect;
export type NewGenerationPreset = typeof generationPresets.$inferInsert;

/**
 * RP-шаблон — источник промптов и порядка сборки запроса RP-чата (системный промпт, сценарий,
 * инструкция после истории, служебный шаблон impersonate, промпт ИИ-перевода). Отдельно от
 * generation_presets, который остаётся источником ТОЛЬКО сэмплинга (режимо-независим, шарится
 * между RP и narrator) — зеркало narrator_templates для RP-режима.
 */
export const rpTemplates = pgTable("rp_templates", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
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
  // Пусто → дефолтный шаблон (DEFAULT_TRANSLATION_TEMPLATE в server/shared/translate.constants.ts).
  translationSystemPrompt: text("translation_system_prompt").notNull().default(""),
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

export type RpTemplate = typeof rpTemplates.$inferSelect;
export type NewRpTemplate = typeof rpTemplates.$inferInsert;

/**
 * RP-чаты: один чат = персонаж + обязательная персона + RP-шаблон (промпты) + пресет (сэмплинг).
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
  // Шаблон и пресет обязательны. FK без onDelete = NO ACTION (restrict): удаление используемого
  // шаблона/пресета блокируется на уровне БД (23503 → 409 in_use), как у story_chats.
  templateId: bigint("template_id", { mode: "number" })
    .notNull()
    .references(() => rpTemplates.id),
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
  // Метод перевода закэшированных сообщений (кнопка Globe): "google" — Google Translate,
  // "ai" — LLM с промптом перевода из RP-шаблона (translationSystemPrompt).
  translateMethod: text("translate_method").$type<"google" | "ai">().notNull().default("google"),
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

// ─── Narrator-режим («Режиссёр истории») ────────────────────────────────────────

/**
 * Книга знаний (lorebook) — переиспользуемый набор фактов о мире/персонажах для narrator-режима.
 * Самостоятельная сущность (как characters/personas/presets): одну книгу можно привязать к разным
 * историям. Сами факты лежат в knowledge_book_entries.
 */
export const knowledgeBooks = pgTable("knowledge_books", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type KnowledgeBook = typeof knowledgeBooks.$inferSelect;
export type NewKnowledgeBook = typeof knowledgeBooks.$inferInsert;

/**
 * Запись книги знаний. Три вида: ссылка на персонажа (characterId — карточка рендерится из characters,
 * без копий), ссылка на персону (personaId — аналогично, из personas) ИЛИ свободный текст (content).
 * Ветки взаимоисключающие (ровно одна ненулевая/непустая). activation — поэлементная: always_on
 * (всегда в промпте, если enabled) или keyword (дополнительно к enabled — только если одно из
 * keywords встретилось в последних keywordDepth сообщениях истории, см. matchesTriggerKeywords).
 * name — метка ТОЛЬКО для UI, в LLM не уходит (как footnote у персонажей). sortOrder — порядок показа/вставки.
 */
export const knowledgeBookEntries = pgTable("knowledge_book_entries", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  bookId: bigint("book_id", { mode: "number" })
    .notNull()
    .references(() => knowledgeBooks.id, { onDelete: "cascade" }),
  // Метка записи для удобства чтения списка — в промпт НЕ передаётся.
  name: text("name").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  activation: text("activation")
    .$type<"always_on" | "keyword">()
    .notNull()
    .default("always_on"),
  // Запись-персонаж: ссылка на карточку. set null при удалении персонажа — запись не пропадает молча,
  // UI покажет «персонаж удалён» (а каскад снёс бы контент книги из-за правки в другом разделе).
  characterId: bigint("character_id", { mode: "number" }).references(() => characters.id, {
    onDelete: "set null",
  }),
  // Запись-персона: ссылка на персону. Симметрично characterId (set null при удалении персоны).
  personaId: bigint("persona_id", { mode: "number" }).references(() => personas.id, {
    onDelete: "set null",
  }),
  // Значение для недостающей стороны в narrator-промпте: у записи-персонажа закрывает {{user}}
  // (нет отыгрываемой персоны), у записи-персоны — {{char}} (нет закреплённого персонажа).
  // Обязательно на уровне контроллера, если промпт содержит соответствующий плейсхолдер.
  alias: text("alias").notNull().default(""),
  content: text("content").notNull().default(""),
  keywords: text("keywords")
    .array()
    .notNull()
    .default(sql`'{}'`),
  // Глубина поиска триггеров для activation="keyword": сколько последних сообщений истории (user +
  // assistant) сканировать на совпадение с keywords. Для always_on поле не используется.
  keywordDepth: integer("keyword_depth").notNull().default(10),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type KnowledgeBookEntry = typeof knowledgeBookEntries.$inferSelect;
export type NewKnowledgeBookEntry = typeof knowledgeBookEntries.$inferInsert;

/**
 * Narrator-шаблон — переиспользуемый источник промптов narrator-режима (нарратор-инструкция:
 * «веди сцену, озвучивай всех персонажей, заканчивай на крючке…») + вспомогательный промпт и порядок
 * сборки запроса. Отдельно от generation_presets, который остаётся источником ТОЛЬКО сэмплинга
 * (режимо-независим, шарится между RP и narrator).
 */
export const narratorTemplates = pgTable("narrator_templates", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull().default(""),
  // Вспомогательный системный промпт — дополнительный блок поверх основного (как у пресета).
  auxiliarySystemPrompt: text("auxiliary_system_prompt").notNull().default(""),
  // Инструкция «после истории» (по образцу postHistoryInstruction у пресета).
  postHistoryInstruction: text("post_history_instruction").notNull().default(""),
  // Системный промпт ИИ-перевода (для шторы перевода черновика в narrator; зеркало пресета).
  translationSystemPrompt: text("translation_system_prompt").notNull().default(""),
  // Инструкция сжатия истории (compact): summarization-промпт с плейсхолдером {{words}}.
  // Пусто → фолбэк DEFAULT_COMPACTION_PROMPT.
  compactionPrompt: text("compaction_prompt").notNull().default(""),
  // Маркер-триггер «продолжай» (см. CONTINUE_MARKER) — обязателен к заполнению в форме; дефолт
  // колонки = текущий встроенный маркер, чтобы существующие шаблоны не поменяли поведение.
  continueMarker: text("continue_marker").notNull().default("Continue the story."),
  // Синтетический leading-user перед корнем (см. LEADING_USER_MARKER) — обязателен к заполнению.
  leadingUserMarker: text("leading_user_marker").notNull().default("Begin the story."),
  // Порядок и включённость компонентов narrator-запроса. Дефолт — канонический порядок;
  // premise идёт после auxiliary, compact — перед history, postHistory выключен (включается вручную).
  promptOrder: jsonb("prompt_order")
    .$type<StoryPromptOrderItem[]>()
    .notNull()
    .default(
      sql`'[{"id":"system","enabled":true},{"id":"lorebook","enabled":true},{"id":"auxiliary","enabled":true},{"id":"premise","enabled":true},{"id":"compact","enabled":true},{"id":"history","enabled":true},{"id":"postHistory","enabled":false}]'::jsonb`,
    ),
  // Схлопнуть все non-history компоненты (всё, что стоит ДО history в promptOrder) в одно
  // system-сообщение, обернув каждый блок в <componentId>…</componentId> — см. storyPromptBuilder.
  mergeSystemPrompts: boolean("merge_system_prompts").notNull().default(false),
  // Рассуждение для ИИ-перевода, независимо от пресета: "off" = отключено; иначе — уровень effort
  // (minimal|low|medium|high|xhigh). Обязательное поле, дефолт "medium" — см. resolveTranslationReasoning.
  translationReasoningEffort: text("translation_reasoning_effort").notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type NarratorTemplate = typeof narratorTemplates.$inferSelect;
export type NewNarratorTemplate = typeof narratorTemplates.$inferInsert;

/**
 * Narrator-история: ИИ ведёт повествование, пользователь — режиссёр. Отдельно от chats (без персоны/
 * одного персонажа — персонажи берутся из книги знаний). bookId/templateId/presetId обязательны;
 * template — источник системного промпта; preset — только сэмплинг. Авторское открытие (дословный
 * бит 1) живёт только в story_messages (корневой узел, parentId null) — здесь не дублируется.
 * premise (зашифрован) опционален — системная вводная «куда вести сцену».
 * activeMessageId — курсор активной ветки; намеренно НЕ FK (цикл story_chats ↔ story_messages).
 */
export const storyChats = pgTable("story_chats", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bookId: bigint("book_id", { mode: "number" })
    .notNull()
    .references(() => knowledgeBooks.id),
  // Шаблон и пресет обязательны (как у RP-чата). FK без onDelete = NO ACTION (restrict):
  // удаление используемого шаблона/пресета блокируется на уровне БД (23503 → 409 in_use).
  templateId: bigint("template_id", { mode: "number" })
    .notNull()
    .references(() => narratorTemplates.id),
  presetId: bigint("preset_id", { mode: "number" })
    .notNull()
    .references(() => generationPresets.id),
  title: text("title"),
  // Системная вводная (куда вести сцену), опц. — пустая строка = не задано. Зашифровано per-user.
  premise: text("premise").notNull().default(""),
  activeMessageId: bigint("active_message_id", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StoryChat = typeof storyChats.$inferSelect;
export type NewStoryChat = typeof storyChats.$inferInsert;

/**
 * Сообщения narrator-истории в виде дерева (parentId = null → корень = openingBeat).
 * kind: beat — бит истории (assistant); continue — «Дальше» (user, эфемерный); directive — режиссёрская
 * директива (user, эфемерная). Эфемерные user-узлы нейтрализуются при сборке контекста (кроме живого).
 */
export const storyMessages = pgTable("story_messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  storyChatId: bigint("story_chat_id", { mode: "number" })
    .notNull()
    .references(() => storyChats.id, { onDelete: "cascade" }),
  parentId: bigint("parent_id", { mode: "number" }).references(
    (): AnyPgColumn => storyMessages.id,
    { onDelete: "cascade" },
  ),
  role: text("role").$type<"user" | "assistant">().notNull(),
  kind: text("kind").$type<"beat" | "continue" | "directive">().notNull(),
  content: text("content").notNull(),
  // JSON-кэш переводов { "ru": "...", "en": "..." }, как у messages.translations. Значения
  // зашифрованы per-user (см. saveStoryTranslation / decryptStoryTranslations).
  translations: jsonb("translations").$type<Record<string, string>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoryMessage = typeof storyMessages.$inferSelect;
export type NewStoryMessage = typeof storyMessages.$inferInsert;

/**
 * Настройки перевода истории (Narrator) — зеркало chatSettings под story_chats.
 * translateScope: на каких ходах показывать кнопку Globe — "all" = все, "assistant" = биты ИИ,
 * "user" = режиссёрские директивы. autoTranslateScope — что переводить сразу при появлении.
 */
export const storySettings = pgTable("story_settings", {
  storyChatId: bigint("story_chat_id", { mode: "number" })
    .primaryKey()
    .references(() => storyChats.id, { onDelete: "cascade" }),
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
  // Метод перевода закэшированных сообщений — зеркало chatSettings.translateMethod.
  translateMethod: text("translate_method").$type<"google" | "ai">().notNull().default("google"),
  // Сжатие истории (compact). compactEnabled — мастер-тумблер чата (вместе с компонентом compact
  // шаблона гейтит и создание, и применение пересказов). compactAutoEnabled — авто-триггер по лимиту.
  // compactFloorTokens — целевой «пол» в токенах (0 = не задано → round(contextSize*0.7) на использовании).
  // compactWords — рекомендованное число слов пересказа (плейсхолдер {{words}}).
  compactEnabled: boolean("compact_enabled").notNull().default(false),
  compactAutoEnabled: boolean("compact_auto_enabled").notNull().default(false),
  compactFloorTokens: integer("compact_floor_tokens").notNull().default(0),
  compactWords: integer("compact_words").notNull().default(200),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StorySettings = typeof storySettings.$inferSelect;
export type NewStorySettings = typeof storySettings.$inferInsert;

/**
 * Сжатые пересказы narrator-истории (compact). Один ряд = пересказ диапазона активного пути,
 * привязанного к id сообщений-якорей (fromAnchorId эксклюзивно/null = от корня; toAnchorId инклюзивно).
 * Якоря намеренно НЕ FK (зеркало storyChats.activeMessageId) — инвалидцию при удалении сообщений
 * делаем вручную (invalidateCompactionsByRemovedIds). Пересказы сцеплены в префикс по seq; применяются
 * к ветке, только если оба якоря лежат на её активном пути. summary зашифрован per-user (как content).
 */
export const storyCompactions = pgTable("story_compactions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  storyChatId: bigint("story_chat_id", { mode: "number" })
    .notNull()
    .references(() => storyChats.id, { onDelete: "cascade" }),
  // Порядок в цепочке (0,1,2…) — пересказы образуют префикс от корня.
  seq: integer("seq").notNull(),
  // Границы покрытого диапазона активного пути. НЕ FK (как activeMessageId).
  fromAnchorId: bigint("from_anchor_id", { mode: "number" }),
  toAnchorId: bigint("to_anchor_id", { mode: "number" }).notNull(),
  // Текст пересказа, зашифрован per-user.
  summary: text("summary").notNull(),
  // Метаданные диапазона (для статистики/отладки).
  coveredCount: integer("covered_count").notNull().default(0),
  coveredTokens: integer("covered_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoryCompaction = typeof storyCompactions.$inferSelect;
export type NewStoryCompaction = typeof storyCompactions.$inferInsert;
