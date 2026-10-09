# Архитектура — карта модулей и границы

Полный инвентарь дерева проекта и детали двух «граблевых» границ (прокси Telegram,
Mini App API). CLAUDE.md держит только верхнеуровневую карту + правила-раскладки;
здесь — подробности.

> ⚠️ Дерево ниже отражает текущее состояние. Что убрали из кода — убираем и отсюда.

---

## Дерево `bot/`

```
bot/src/
  main.ts       — entry point: bootstrap Nest (мост в legacy Hono, лимит JSON-тела) + старт бота
  app.module.ts — корневой модуль Nest: LoggerModule (nestjs-pino поверх logger.ts), глобальные
                  ValidationPipe (common/validation-pipe) и ApiExceptionFilter (common/), модули ниже
  auth/         — TelegramAuthGuard (глобальный APP_GUARD) + @CurrentUser() (внутренний userId) +
                  initData.ts — проверка initData, общая с Hono-middleware
  database/     — DatabaseModule (@Global) + DatabaseService поверх drizzle-клиента из db/index.ts
  users/        — UsersService.ensureTelegramUser (upsert строки users, кэш на процесс)
  common/       — ApiExceptionFilter (ошибки → { error }), createValidationPipe, found() (undefined → 404),
                  decorators/ (IsDataImageUrl — поле-картинка data URL с лимитом; IsOptionalNote — сноска, пусто → null)
  characters/ personas/ presets/ rp-templates/ narrator-templates/ cards/ — доменные модули Nest: controller / service / repository (бывший DAO) / dto/;
                  у cards/ ещё card-lock.ts (лок карточки, общий для PUT и генерации) и generation/ — поблочная
                  генерация: card-generation.service (Nest-сервис) + prompt-assembly / tool-loop (web_search +
                  ask_user) / ask-user-tool
  settings/     — /api/settings (всё в строке user_settings): llm/ (ключ/модель DeepSeek, BYOK, шифруется
                  ENCRYPTION_KEY; verify — /models, баланс), tavily/ (ключ Tavily + лимит раундов поиска),
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
  translate/    — POST /api/translate/text: безэнтитный батч-перевод абзацев (режим перевода
                  PromptEditorOverlay) — controller / service / dto/; engine/ — движок перевода без Nest
                  (googleTranslate, aiTranslate, resolveTranslationReasoning, чанкинг блока, разбивка на
                  абзацы, константы), общий с legacy-переводом в server/chats и server/stories
  bot.ts        — grammY bot instance (+ прокси для Telegram через baseFetchConfig)
  bot.constants.ts
  config.ts     — env vars (requireEnv для обязательных, process.env для опциональных)
  logger.ts     — pino logger (daily rolling, pino-pretty in TTY)
  proxy.ts      — HttpsProxyAgent (https-proxy-agent) для Telegram; тот же TELEGRAM_PROXY_URL
                  переиспользуется для Tavily, но через отдельный undici ProxyAgent (см. tavily/)
  db/           — drizzle: schema.ts (+ schema.types.ts — id-типы/порядок промптов) + клиент +
                  DAO-папки по таблицам: characters/ personas/ presets/ rpTemplates/ narratorTemplates/
                  impersonations/ (characters/ personas/ presets/ rpTemplates/ narratorTemplates/ —
                  временные мосты getCharacter/getPersona/getPreset/getRpTemplate/getNarratorTemplate
                  на репозитории Nest для ещё не перенесённых books/chats/stories), settings/ (мост
                  getDecryptedDeepSeekCredentials для resolveProvider) (у каждой DAO-файл + types.ts/constants.ts при наличии + barrel index.ts;
                  типы контракта API перенесённых в Nest доменов — из @tg-rp-bot/shared),
                  chats/ stories/ (+ storyAvatars.ts — LATERAL-фрагмент топ-N аватаров книги знаний
                  для карточки истории) knowledge/ (деревья/лорбук), users.ts
  llm/          — LLM client (client/request/errors/types/constants/completionGuard/providers/
                  resolveProvider/deepseekModels) — серверно; единственный активный провайдер —
                  DeepSeek, ключ/модель резолвятся per-user через resolveProvider(userId) из
                  settings/llm (без ключа — MissingApiKeyError); фабрика buildOpenRouterProvider
                  в providers.ts не задействована (задел, нет пути конфигурации);
                  debugCapture (+debug.types, debugSettings — кламп настроек) — in-memory перехват RAW-запросов
                  к LLM для экрана отладки (горячий путь каждого вызова; настройки — в debug/)
  tavily/       — Tavily API client (per-user BYOK): tavilyUsage.ts (getTavilyUsage — GET /usage,
                  через fetch/ProxyAgent из пакета undici, TELEGRAM_PROXY_URL), errors.ts (TavilyHttpError)
  handlers/     — обработчики команд/кнопок бота (index = registerHandlers, start.ts,
                  photoActions.ts — callback «Закрыть» под фото из лайтбокса)
  server/       — legacy Hono HTTP API (переезжает на Nest по доменам — docs/plan/roadmap.md):
                  legacyBridge.ts — express-middleware, отдающий в Hono всё вне NEST_ROUTE_PREFIXES;
                  index=createLegacyApp,
                  routes.ts — карта эндпоинтов (монтаж контроллеров), middleware/ (initData — валидация
                  подписи), доменные папки me/ books/
                  chats/ stories/ — у каждого
                  <домен>.controller.ts (Hono-роуты) + validation/
                  constants/types рядом + barrel index.ts; chats/ — messages.handlers + impersonate.handlers
                  + stats.handler; stories/ — story.handlers (SSE-генерация RP/narrator); prompt/ —
                  promptBuilder + storyPromptBuilder + общий budget (у каждого constants/types/test рядом);
                  media/ — profilePhoto + photoToChat (POST /me/send-photo); shared/ — fkViolation,
                  imageValidation, streamGeneration, apiError (переиспользуемое между доменами)
                  + раздача собранной статики Mini App из ./public (SPA-fallback) — один процесс
  scripts/      — разовые скрипты (backfill-message-encryption)
  utils/        — retry, crypto (per-user шифрование сообщений), concurrency (runWithConcurrency —
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
доходит до Telegram, с `dispatcher` — уходит напрямую в обход прокси. Отсюда каст в `bot.ts`
(`proxy.ts` → `HttpsProxyAgent` → `client.baseFetchConfig.agent`).

Tavily-клиент (`bot/src/tavily/tavilyUsage.ts`) устроен иначе: он вызывает `fetch` и `ProxyAgent`
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
(`auth/initData.ts` — общая функция для guard'а Nest `auth/telegram-auth.guard.ts` и Hono-middleware
`server/middleware/initData.ts`) **проверяет HMAC-подпись** по `BOT_TOKEN` через
**`@tma.js/init-data-node`** (`validate` бросает при подделке/просрочке, `parse` достаёт юзера в
`c.get("tgUser")` у Hono, в `request.userId` → `@CurrentUser()` у Nest). Без подписи: в проде → 401, в dev → пропускаем (отладка webapp из браузера).

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
