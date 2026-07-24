# Narrator-режим («Режиссёр истории») и сжатие истории

Второй режим игры: ИИ ведёт повествование между персонажами, пользователь — режиссёр (направляет
**директивами**, не отыгрывает роль). Сделан **новыми** доменными таблицами/модулями (не поверх
RP-чата), переиспользуя только реально переиспользуемое (шифрование, LLM-клиент, SSE-стриминг, чистые
хелперы `promptBuilder`).

> Острый инвариант, который легко нарушить при правке `storyPromptBuilder`, продублирован строкой в
> CLAUDE.md. Полная матчасть — здесь.

---

## Модули

- **БД:** `knowledge_books` + `knowledge_book_entries` (lorebook: запись = ссылка на персонажа **или**
  свободный текст; `activation` поэлементная `always_on|keyword`, у keyword — свои `keywords` (список
  триггер-слов) и `keywordDepth` (default 10, сколько последних сообщений сканировать)), `narrator_templates`
  (промпты нарратора: `systemPrompt` + `auxiliarySystemPrompt` + `postHistoryInstruction` +
  `compactionPrompt` (инструкция сжатия, плейсхолдер `{{words}}`) + `promptOrder` — порядок/включённость
  **7** компонентов `system|premise|lorebook|auxiliary|compact|history|postHistory`, зеркало пресета;
  сэмплинг по-прежнему из `generation_presets`), `story_chats`
  (`openingBeat` **обязателен** — дословный бит 1; `premise` опц.; `bookId`/`templateId`/`presetId`
  **обяз.**, FK без onDelete = restrict → удаление используемого шаблона/пресета даёт 409 in_use)
  + `story_messages` (дерево, `kind: beat|continue|directive`; `translations` — JSON-кэш переводов,
  зашифрован per-user, как у `messages`) + `story_settings` (перевод истории + сжатие `compactEnabled`/
  `compactAutoEnabled`/`compactFloorTokens`/`compactWords`, зеркало `chat_settings`) +
  `story_compactions` (пересказы сжатых сообщений — см. раздел compact ниже).
- **Сервер:** `db/knowledge/`, `db/narratorTemplates/`, `db/stories/` (зеркало `db/chats/`,
  вкл. `settings.ts` и `crypto.ts` — расшифровка кэша переводов); `server/prompt/storyPromptBuilder/`
  (+тест), `server/stories/story.handlers.ts` (вкл. перевод бита/директивы через `googleTranslate`) +
  контроллер `server/stories/stories.controller.ts`, домены-роуты `books/`/`narrator-templates/`/`stories/`
  (у `stories` — `settings` GET/PUT + `messages/:id/translate`).
- **Webapp:** фичи `narrator`/`knowledge-books`/`narrator-templates`, страницы `pages/narrator/*`,
  `pages/knowledge-books/*`, `pages/narrator-templates/*`; кнопки на главной (Режим игры + Библиотека).
  Перевод истории — раздел в `StorySettingsPage` + кнопка-Globe на битах/директивах в ленте
  (`useStorySettings`/`useTranslatable`), зеркало RP-чата. Редактор шаблона (`TemplateForm`) — поля
  промптов + блок «Порядок промптов». Кросс-фичевые компоненты в `shared/components`: `ExpandableSelect`
  (настройки перевода RP и narrator) и `PromptOrderEditor` (дженерик-редактор порядка промптов с пропсами
  `labels`/`sources`/`unimplemented` — используют пресеты ИИ и narrator-шаблоны; у каждой фичи свои карты
  подписей/источников и `DEFAULT_*_PROMPT_ORDER`).

---

## Ключевой инвариант сборки промпта

`storyPromptBuilder.buildStoryMessages`: отыгранные user-ходы (директивы/continue) **нейтрализуются**
в `CONTINUE_MARKER`, кроме последнего (живого триггера) — их последствие уже в тексте следующего бита,
повторно инструктировать нельзя. Перед корнем (openingBeat — `assistant`) вставляется синтетический
leading-user — иначе массив начинался бы с assistant, что отвергают Anthropic (через OpenRouter) и
reasoner DeepSeek. Книга знаний: `always_on`-записи идут в промпт всегда; `keyword`-записи — только если
хотя бы одно из её триггер-слов встретилось (word-boundary матч по Unicode-классам `\p{L}`/`\p{N}`,
регистронезависимо, ё↔е нормализация — `server/prompt/keywordMatch.ts`) среди последних `keywordDepth`
сообщений **активного пути** истории (`story.messages`, весь путь, не урезанный под токен-бюджет `history`
ниже) — намеренно: лорбук должен донести факт, даже если само сообщение-триггер потом не поместилось в
бюджет и не попало в реальный промпт модели.

Сборка идёт **итерацией по `promptOrder` шаблона** (как `promptBuilder.buildMessages` у RP): выключенные/
пустые компоненты пропускаются; все non-history части → отдельным сообщением role `system`; `history` →
leading-user + нейтрализованный путь. Leading-user и нейтрализация — свойства **блока history**, поэтому
позиция в порядке их не ломает. `resolveHistory` (бюджет обрезки) суммирует **все включённые non-history**
компоненты и зовётся, только если `history` включён. Дефолт порядка (`DEFAULT_NARRATOR_PROMPT_ORDER` в
`storyPromptBuilder.ts`, зеркалится в webapp): `system, lorebook, auxiliary, premise, compact, history,
postHistory`, где `postHistory` выключен. Фолбэк (история без шаблона) — этот же дефолт +
`DEFAULT_NARRATOR_TEMPLATE`. Старые 6-элементные `promptOrder` нормализуются на чтении
(`normalizeStoryPromptOrder` — дописывает недостающие компоненты на дефолтную позицию), без data-миграции.

**`mergeSystemPrompts`** (флаг шаблона, чекбокс в `TemplateForm`): все non-history компоненты, стоящие в
`promptOrder` **до** `history`, схлопываются в одно `system`-сообщение, каждый блок обёрнут в
`<componentId>…</componentId>` (напр. `<system>`, `<lorebook>`, `<premise>`). Компоненты **после** `history`
(напр. включённый `postHistory`) склейка не трогает — идут отдельным сообщением, как обычно. Бюджет
обрезки (`fixedSystemTokens` в `buildStoryMessages`) считается по **фактически** эмитируемым pre-history
сообщениям (с учётом склейки и токенов тегов), а не по компонентам по отдельности — иначе при включённой
склейке бюджет разъехался бы с реальным промптом.

**`translationReasoningEffort`** (обязательное поле шаблона, дефолт `"medium"`; селектор в `TemplateForm`
рядом с промптом перевода): рассуждение ИИ-перевода (штора перевода директив/битов) — независимо от
пресета истории. `"off"` — рассуждение для перевода отключено; конкретный уровень
(`minimal|low|medium|high|xhigh`) — форсирует и включённость, и эффорт. Резолвится чистой функцией
`resolveTranslationReasoning` (`server/shared/translate.ts`, тест рядом) и передаётся в общий `aiTranslate`
(используется и RP-чатом, который всегда шлёт `requestReasoning:true` + эффорт из `preset.reasoningEffort` —
там своего поля перевода для рассуждения нет).

---

## Сжатие истории (compact)

Старые сообщения активной ветки сжимаются LLM в краткий пересказ, который идёт в запрос **отдельным
системным блоком** (компонент `compact`), а не в ленту `history`. Освобождает контекст, сохраняя суть.

- **Таблица `story_compactions`** (`db/stories/compactions.ts`): пересказ диапазона активного пути,
  привязан к id сообщений-якорей `fromAnchorId`(эксклюзивно/`null`=корень)/`toAnchorId`(инклюзивно, всегда
  **бит**). Якоря **НЕ FK** (зеркало `activeMessageId`). `summary` шифруется per-user. Пересказы сцеплены в
  **префикс по seq**; применяются к ветке, только если оба якоря на её активном пути — иначе игнорируются
  (ветка сожмётся заново). Выбор валидной цепочки — чистая `selectValidChain` (filter-then-walk, тест).
- **Двойной гейт (создание И применение):** работает, только когда включены **оба** — компонент `compact`
  в `promptOrder` шаблона **и** `compactEnabled` чата. Выключение неразрушающе (пересказы остаются в БД,
  возвращаются при включении). Применение в `storyContext.buildStoryCompletionInput`; гейт+доступность —
  `compact.gate.ts` (`compactAvailable`: есть лимит и `>= MIN_COMPACT_CONTEXT` 4000).
- **Операция** (`compact.handler.ts` `compactStory`): сегментирует живой хвост по ~`contextSize−floor`
  токенов (чистая `planCompactionSegments`, тест), каждый сегмент → отдельный LLM-вызов (`debugLabel:
  "compact"`, прошлые пересказы как «story so far»), пока вход не упадёт ≤ floor. Текущий лист не сжимаем.
  Lock по `storyId`. Триггеры: ручной `POST /compact` и авто перед битом в `handleAdvanceStory`
  (`shouldAutoCompact`, синхронно, fail-safe — падение не роняет advance, остаётся `trimHistoryToBudget`).
- **Инвалидция:** `deleteStoryMessage` зовёт `invalidateCompactionsByRemovedIds` — каскад вперёд по seq,
  если якорь попал в удалённое (см. оговорку про глобальный seq в коде). Токены везде — `countTokens` (o200k).
- **Webapp:** секция «Сжатие истории» в `StorySettingsPage` (`CompactSettingsSection` — тумблеры, слайдеры
  пол/слова, кнопка «Сжать сейчас», список пересказов с удалением, гейт по `stats.compactAvailable`);
  поле `compactionPrompt` в `TemplateForm`; SSE-событие `status` (`phase:"compacting"`) в `StoryPage`.
