# Архитектура — карта модулей и границы

Полный инвентарь дерева проекта и детали двух «граблевых» границ (прокси Telegram,
Mini App API). CLAUDE.md держит только верхнеуровневую карту + правила-раскладки;
здесь — подробности.

> ⚠️ Дерево ниже отражает текущее состояние. Что убрали из кода — убираем и отсюда.

---

## Дерево `bot/`

```
bot/src/
  main.ts       — entry point: bootstrap Nest (лимит JSON-тела, глобальный префикс api с исключением
                  health, статика Mini App, enableShutdownHooks); бот стартует из telegram/
  app.module.ts — корневой модуль Nest: LoggerModule (nestjs-pino поверх logger.ts), глобальные
                  ValidationPipe (common/validation-pipe) и ApiExceptionFilter (common/), модули ниже
  auth/         — TelegramAuthGuard (глобальный APP_GUARD) + @CurrentUser() (внутренний userId) +
                  @TelegramUser() (профиль Telegram — только для me/, где нужен Telegram id для Bot API) +
                  initData.ts — проверка initData (чистая функция) + @Public() (маршрут без авторизации —
                  только health/)
  database/     — DatabaseModule (@Global) + DatabaseService поверх drizzle-клиента из db/index.ts
  users/        — UsersService (ensureTelegramUser для guard: upsert строки users с кэшем на процесс;
                  saveTelegramProfile для /start: всегда) + UsersRepository
  common/       — ApiExceptionFilter (ошибки → { error }), createValidationPipe, found() (undefined → 404),
                  image-limits (лимиты полей-картинок data URL), fk-violation (FK 23503 → 409 in_use),
                  llm-http-error (ошибка не-стримингового LLM-вызова → 400 no_api_key / 500), query-int
                  (число из query: повтор → первое, нечисло → дефолт),
                  decorators/ (IsDataImageUrl — поле-картинка data URL с лимитом; IsOptionalNote — сноска, пусто → null),
                  sse-observable (async-функция → Observable для Nest @Sse; отписка клиента генерацию не
                  прерывает), stream-completion (streamCompletion/writeGenerationError — LLM-генерация в SSE-события
                  token/reset/error через интерфейс SseSink)
  characters/ personas/ presets/ rp-templates/ narrator-templates/ cards/ — доменные модули Nest: controller / service / repository (бывший DAO) / dto/;
                  у cards/ ещё card-lock.ts (лок карточки, общий для PUT и генерации) и generation/ — поблочная
                  генерация: card-generation.service (Nest-сервис) + prompt-assembly / tool-loop (web_search +
                  ask_user) / ask-user-tool
  settings/     — /api/settings (всё в строке user_settings): llm/ (ключ/модель DeepSeek, BYOK, шифруется
                  ENCRYPTION_KEY; verify — /models, баланс), tavily/ (ключ Tavily + лимит раундов поиска; verify — TavilyService),
                  translate/ (режим перевода PromptEditorOverlay) — у каждой controller/service/repository;
                  dto/ (снисходительные PATCH: невалидное поле игнорируется), key-format.ts (400
                  invalid_key_format); экспортирует TavilySettingsRepository (генерация карточек) и
                  TranslateSettingsRepository (перевод)
  debug/        — /api/debug/llm: настройки перехвата LLM (repository — колонки user_settings) + записи из
                  in-memory кольца llm/debugCapture; DebugService праймит кэш настроек на старте
                  (OnApplicationBootstrap)
  avatars/      — POST /api/avatars/batch: батч-резолв картинок персонажей/персон для AvatarStack
                  (см. ниже) — controller / service (лимит батча) / repository / dto/ (некорректные
                  дескрипторы молча выпадают)
  knowledge-books/ — /api/books: книги знаний (lorebook) narrator-режима — books/ (CRUD, лимит книг,
                  409 in_use) и entries/ (записи книги: ссылка на своего персонажа/персону с alias или
                  свободный текст; лимит, reorder — только полная перестановка, entry-alias, entries-order;
                  entries-prompt.repository — записи для промпта истории); у каждой controller/service/
                  repository/dto/; персонажи и персоны — через DI (CharactersModule, PersonasModule)
  rp-chat/      — /api/chats: RP-чаты — chats/ (список, создание из своих персонажа/персоны/шаблона/
                  пресета, чат с активным путём, переименование, граф веток), messages/ (ветка, удаление
                  поддерева), translation/ (перевод сообщения с кэшем, эфемерный перевод текста),
                  settings/ (настройки перевода, снисходительный PUT), stats/ (токены, лимит контекста),
                  impersonations/ (сохранённые варианты реплик игрока), generation/ (SSE через @Sse на POST:
                  ответ ИИ на отправку/правку/перегенерацию с управлением курсором, вариант impersonate;
                  rp-completion — сборка запроса к LLM из контекста чата); у каждой controller/service/
                  repository/dto/; chat-context.service (чат + персонаж/персона/шаблон/пресет с проверкой
                  владельца, сообщение этого чата), chat-path.repository (активный путь и листья дерева),
                  message-crypto
  narrator/     — /api/stories: истории narrator — stories/ (список, создание из своих книги/шаблона/
                  пресета, история с активным путём, правка названия/премизы, граф; story-avatars — LATERAL
                  топ-N аватаров книги), messages/ (ветка, правка бита на месте, удаление поддерева с
                  прунингом осиротевших ходов), translation/ (перевод бита/директивы с кэшем, эфемерный
                  перевод; ai-translate-story-text — ИИ-перевод по абзацам), settings/ (перевод, сжатие,
                  тулбар; пол сжатия клампится по пресету), stats/ (токены, доступность сжатия),
                  compaction/ (пересказы: список/удаление каскадом; compact-gate, live-tail, compacted-ids —
                  чистые функции), generation/story-completion (сборка запроса к LLM из контекста истории);
                  story-context.service (история + шаблон/пресет/настройки/записи книги/пересказы с
                  проверкой владельца), story-path.repository, generation/ (SSE через @Sse на POST: advance —
                  ход + бит, регенерация бита с точным откатом курсора; авто-сжатие перед битом),
                  compaction/story-compaction.service (проход сжатия; блокировка по истории — поле синглтона,
                  общая для ручного POST /compact и авто-сжатия; story-compaction-plan — чистый план)
  me/           — /api/me: профиль из initData, фото профиля (GET /photo) и фото из лайтбокса себе в
                  чат (POST /send-photo) — controller / service / dto/; media/ — profile-photo (ProfilePhotoService:
                  Bot API + кэш на час) и lightbox-photo (LightboxPhotoService: sendPhoto с web_app-кнопкой deep
                  link и «Закрыть»); бот и прокси-агент — из telegram/ через DI
  translate/    — POST /api/translate/text: безэнтитный батч-перевод абзацев (режим перевода
                  PromptEditorOverlay) — controller / service / dto/ (+ DTO перевода сообщений, общие для rp-chat/ и
                  narrator/); engine/ — движок перевода без Nest
                  (googleTranslate, aiTranslate, resolveTranslationReasoning, чанкинг блока, разбивка на
                  абзацы, константы), общий с переводом в rp-chat/ и narrator/
  prompt/       — сборка промптов без Nest: promptBuilder (RP-чат, impersonate, сэмплинг пресета) +
                  storyPromptBuilder (narrator) + общий budget, compactionPlan, keywordMatch,
                  storyPromptOrder, templateTokenWeight (у каждого constants/types/test рядом)
  telegram/     — бот grammY как провайдер Nest: экземпляр Bot (токен-класс; telegram-bot.factory — прокси
                  через baseFetchConfig) и прокси-агент (TELEGRAM_PROXY_AGENT, telegram-proxy — HttpsProxyAgent;
                  тот же TELEGRAM_PROXY_URL переиспользуется для Tavily, но через undici ProxyAgent, см. tavily/);
                  telegram-polling.service (bot.catch, long polling из onApplicationBootstrap без ожидания,
                  остановка в onApplicationShutdown); handlers/ — провайдеры, подключающиеся к боту в onModuleInit:
                  start.handler (/start: профиль в users через UsersService, кнопка Mini App),
                  photo-actions.handler (callback «Закрыть» под фото из лайтбокса)
  config.ts     — env vars (requireEnv для обязательных, process.env для опциональных)
  logger.ts     — pino logger (daily rolling, pino-pretty in TTY)
  db/           — drizzle: schema.ts (+ schema.types.ts — id-типы/порядок промптов) + index.ts
                  (клиент — только через DatabaseService; репозитории доменных модулей берут schema)
  llm/          — LlmModule: LlmService.complete (ключ/модель пользователя из settings/llm на
                  каждый вызов, без ключа — MissingApiKeyError) + чистый клиент (client/request/
                  errors/types/constants/completionGuard/providers/deepseekModels) — серверно;
                  единственный активный провайдер — DeepSeek; фабрика buildOpenRouterProvider
                  в providers.ts не задействована (задел, нет пути конфигурации);
                  debugCapture (+debug.types, debugSettings — кламп настроек) — in-memory перехват RAW-запросов
                  к LLM для экрана отладки (горячий путь каждого вызова; настройки — в debug/)
  tavily/       — TavilyModule: TavilyService (search — POST /search для web_search генерации карточек,
                  getUsage — GET /usage для проверки ключа; ключ параметром вызова, per-user BYOK) через
                  fetch из пакета undici + ProxyAgent-провайдер (tavily-proxy.ts, TELEGRAM_PROXY_URL);
                  WebSearcher (поиск с подставленным ключом — параметр чистого tool-loop), схема
                  инструмента web_search, errors.ts (TavilyHttpError), searchSettings (кламп раундов)
  health/       — GET /health → { ok: true } (вне префикса /api, @Public — для мониторинга)
  webapp-static/ — раздача собранной Mini App из ./public (cwd; в Docker — /app/bot/public), только если
                  каталог есть (в dev — Vite): файлы сборки, затем index.html на маршруты React;
                  spa-fallback — чистое решение «index.html или дальше в Nest» (/api и /health — в Nest,
                  неизвестный /api/* → JSON 404). Express-middleware до маршрутов Nest, не контроллер —
                  иначе глобальный guard отдал бы на страницу 401
  scripts/      — разовые скрипты (backfill-message-encryption)
  utils/        — retry, crypto (per-user шифрование сообщений и кэша переводов), concurrency (runWithConcurrency —
                  пул с ограниченной конкурентностью)
```

## Пакет `shared/` (`@tg-rp-bot/shared`)

```
shared/src/
  index.ts      — публичная поверхность пакета (реэкспорт доменных файлов)
  characters.ts — CharacterInput, CharacterListItem, MAX_CHARACTERS_PER_USER, MAX_FIRST_MESSAGES
  personas.ts   — PersonaInput, PersonaListItem, MAX_PERSONAS_PER_USER
  presets.ts    — PresetInput, PresetListItem, SamplingKey, REASONING_EFFORTS, MAX_PRESETS_PER_USER
  rp-templates.ts — RpTemplateInput, RpTemplateListItem, PromptComponentId/PromptOrderItem,
                  PROMPT_COMPONENT_IDS, MAX_RP_TEMPLATES_PER_USER
  narrator-templates.ts — NarratorTemplateInput, NarratorTemplateListItem, StoryPromptComponentId/
                  StoryPromptOrderItem, DEFAULT_NARRATOR_PROMPT_ORDER, TRANSLATION_REASONING_LEVELS,
                  DEFAULT_TRANSLATION_REASONING_EFFORT, MAX_NARRATOR_TEMPLATES_PER_USER
  …            — по файлу на каждый перенесённый домен (cards, settings, debug, translate, avatars, me,
                  knowledge-books)
  rp-chat.ts    — RP-чат: ChatListItem/ChatDetail/MessageInPath/TreeNode, ChatSettings (TRANSLATE_SCOPES,
                  AUTO_TRANSLATE_SCOPES), ChatStats, ImpersonationVariant, тела запросов; лимиты
                  (страница списка, длина названия, MAX_IMPERSONATION_VARIANTS)
  sse.ts        — SSE_EVENTS (token/reset/userMessage/status/done/error) + данные token/error —
                  общие для стримов RP-чата и narrator
```
Контракт API (то, что ходит JSON'ом) и общие константы bot ↔ webapp. Собирается `tsc` (`nodenext`)
в `shared/dist` (`.js` + `.d.ts`), оба пакета подключают его как зависимость workspace и читают
собранный `dist` через `exports` — отдельной настройки резолва в Vite/vitest/tsx не нужно. Почему не
исходники напрямую: при импорте `.ts` из-за пределов `bot/src` tsc бота упирается в `rootDir`, а прод
(`node dist/index.js`) не умеет исполнять `.ts` с `.js`-импортами.

## Дерево `webapp/`

```
webapp/src/
  main.tsx      — точка входа: initTelegram() + рендер <App/>
  init.ts       — инициализация @telegram-apps SDK (защищённая) + initData.restore()
  app/          — оболочка: App.tsx (AppRoot + HashRouter), routes.ts, BackButtonBridge, deepLink.ts
  pages/        — экраны-маршруты (один на маршрут): home/ characters/ personas/ cards/
                  generation-presets/ rp-templates/ rp-chat/ narrator/ knowledge-books/
                  narrator-templates/ debug/
  features/     — доменные модули (по подпапкам-категориям + barrel index.ts):
                  characters/ personas/ cards/ (черновики «Мастерской», с выгрузкой в персонажа/персону)
                  generation-presets/ rp-templates/ rp-chat/ narrator/
                  knowledge-books/ narrator-templates/ debug/ llm-settings/ (per-user ключ/модель
                  DeepSeek, BYOK, экран /settings) tavily-settings/ (per-user ключ Tavily + квота,
                  BYOK, экран /settings)
  shared/       — кросс-каттинг: api/ (client с Authorization), telegram/ (initData, confirm, profile
                  photo, platform), text/, image/, graph/, hooks/, constants/, toast/, components/,
                  avatar/ (avatarCache — dataURL-кэш на сессию SPA, avatars-api — обёртка над
                  /api/avatars/batch, useAvatarBatch — хук резолва для AvatarStack)
```

### Раскладка фичи (`features/<feature>/`)

```
index.ts    — публичная поверхность фичи (то, что нужно страницам)
api/        — обёртки над apiFetch (граница к /api), доменные файлы (НЕ один barrel)
hooks/      — React-хуки фичи
components/ — .tsx-компоненты (+ фичевый .css рядом, если есть)
types/      — типы фичи (один файл с доменным именем, напр. character.ts)
lib/        — чистые хелперы и данные (форматтеры, спеки, парсеры, mock)
```
Категории без файлов не заводим.

Правила раскладки (pages vs features, barrel, импорты внутри фичи) — в CLAUDE.md → «webapp — mandatory».
Пример потребителя: `import { CharacterForm, useCharacter } from "../../features/characters"`.

### Роутер и deep-link
- **`HashRouter`** (react-router-dom): маршрут в hash переживает reload. Нативная кнопка «Назад» Telegram
  связана с роутером в `app/BackButtonBridge.tsx` — `navigate(parentPath(...))`, т.е. вверх по иерархии,
  а не по истории. Catch-all `*` → главная: на Telegram Web launch-параметры приходят в hash, и без
  редиректа роутер показал бы пустой экран.
- **Deep-link из бота** (`app/deepLink.ts` + `main.tsx`): web_app-кнопка под фото из лайтбокса открывает
  Mini App с `?dl=<путь>` (напр. `/characters/123`). `resolveDeepLink()` вызывается **до** `render()`
  (после `initTelegram()`, который уже считал launch-данные из hash) и переписывает hash на маршрут —
  иначе catch-all успел бы увести на главную. Делать это в компоненте внутри роутера НЕЛЬЗЯ: эффект
  `<Navigate>` из catch-all в том же flush перебьёт переход.

---

## Прокси для Telegram и Tavily — детали

Правило (в CLAUDE.md): прокси `TELEGRAM_PROXY_URL` цепляется только к сервисам, недоступным
напрямую с сети сервера — Telegram и Tavily (оба отдают `403 Forbidden` от awselb ещё до
приложения без прокси), глобальный прокси запрещён. У Telegram и Tavily механизм проксирования
разный:

⚠️ grammY в Node использует **node-fetch@2** (не нативный fetch!), который проксируется через
option `agent`. undici `dispatcher` он **игнорирует** — хотя тип `baseFetchConfig` выведен из
нативного fetch и обманчиво подсказывает `dispatcher`. Проверено рантайм-тестом: с `agent` getMe
доходит до Telegram, с `dispatcher` — уходит напрямую в обход прокси. Отсюда каст в
`telegram/telegram-bot.factory.ts` (`telegram-proxy.ts` → `HttpsProxyAgent` → `client.baseFetchConfig.agent`).

Tavily-клиент (`bot/src/tavily/tavily.service.ts`, диспетчер — `tavily-proxy.ts`) устроен иначе: он вызывает `fetch` и `ProxyAgent`
из самого пакета **undici**, а не встроенный Node `fetch` с `dispatcher` — та комбинация не
заводится из-за несовместимой версии undici внутри Node. Прокси там подключается через
`dispatcher`, а не `agent` (в отличие от grammY выше).

Глобальный прокси (`HTTPS_PROXY` / `ALL_PROXY`) увёл бы через прокси и трафик к LLM-провайдеру
(DeepSeek) — нельзя.

---

## Mini App API — детали границы

Правило (в CLAUDE.md): ключ LLM-провайдера (DeepSeek, per-user BYOK) только серверно; webapp ходит
в `/api/*` с подписанным `initData`. Детали валидации:

Запросы webapp → `/api/*` несут подписанный Telegram `initData` в заголовке
`Authorization: tma <initData>` (webapp: `shared/api/client.ts`). Сервер
(`auth/initData.ts` — функция для guard'а Nest `auth/telegram-auth.guard.ts`) **проверяет HMAC-подпись** по `BOT_TOKEN` через
**`@tma.js/init-data-node`** (`validate` бросает при подделке/просрочке, `parse` достаёт юзера в
`request.userId` → `@CurrentUser()`). Без подписи: в проде → 401, в dev → пропускаем (отладка webapp из браузера).

⚠️ Серверный пакет — **`@tma.js/init-data-node`**, НЕ `@telegram-apps/init-data-node` (последний
deprecated). Это противоположно выбору org для **webapp** (там `@telegram-apps/*` — см. README/стек):
не «чинить» ради единообразия. По умолчанию `validate` считает initData просроченным через сутки
(`expiresIn` = 86400) — учесть для долгих сессий webview (дадут 401).

Картинки отдаются по двум разным паттернам: поштучно (`GET /characters/:id/image`,
`characters/characters.controller.ts`, Nest) — для форм редактирования, где нужна ровно одна карточка; батчем
(`POST /avatars/batch`, `avatars/`, Nest) — для AvatarStack (стек аватаров в списке историй / шапке
чата), где на экране сразу N дескрипторов {type, id} и поштучные запросы дали бы N round-trip'ов.
Батч отдаёт только найденные картинки (чужие/несуществующие/пустые id молча выпадают), результат
кэшируется в webapp на сессию SPA (`shared/avatar/avatarCache.ts`).
