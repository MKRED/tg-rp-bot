# tg-rp-bot — Claude Code Instructions

## Package manager
Always use **yarn**. Never use npm.

## Монорепо (Yarn workspaces)
Проект — монорепо из двух workspace-пакетов:
- **`bot/`** — Telegram-бот (grammY) + HTTP API для Mini App (Hono). Node 24, native ESM.
- **`webapp/`** — Telegram Mini App (React + Vite).

Корневой `package.json` — только менеджер workspaces + сквозные скрипты (`yarn dev`, `yarn test`, `yarn build`).

## Module system
**Важно:** правила ниже относятся к **`bot/`** (Node ESM). В **`webapp/`** (Vite/React, `moduleResolution: bundler`) импорты пишутся БЕЗ расширений (`./App`, не `./App.js`).

`bot/` — **native ESM** (`"type": "module"`, tsconfig `module`/`moduleResolution: nodenext`).
- Every **relative** import/export MUST carry an explicit `.js` extension — even though the source file is `.ts`. Example: `import { config } from "../config.js";`
- Importing a directory does **not** work — point at the barrel file explicitly: `import { X } from "../utils/index.js";`
- Bare package imports (`grammy`, `drizzle-orm`, …) stay extensionless as usual.

## Dev workflow
Команды запускаются из корня монорепо. Drizzle-kit работает в контексте `bot/`.
```
yarn dev           # start bot (= yarn workspace bot dev) — run in background
yarn dev:web       # start Mini App (Vite dev server)
Stop-Process -Name "node"  # stop bot
yarn workspace bot drizzle-kit generate  # generate migration from schema changes
yarn workspace bot drizzle-kit migrate   # apply migrations to DB
yarn test          # run bot unit tests once (vitest run)
yarn test:watch    # run tests in watch mode
yarn build         # build bot + webapp
```

## Architecture

```
bot/src/
  index.ts      — entry point (thin: register handlers + start server + start bot)
  bot.ts        — grammY bot instance (+ прокси для Telegram через baseFetchConfig)
  config.ts     — env vars (requireEnv for mandatory, process.env for optional)
  logger.ts     — pino logger (daily rolling, pino-pretty in TTY)
  proxy.ts      — HttpsProxyAgent (https-proxy-agent) ТОЛЬКО для Telegram
  config.ts     — env vars (requireEnv для обязательных)
  db/           — drizzle: schema.ts + клиент + DAO по таблицам (chats, characters, personas,
                  presets, impersonations, users, userSettings); chats — папка (queries/messages/settings/crypto)
  llm/          — LLM client (client/types/constants/completionGuard/providers) — серверно,
                  провайдер (OpenRouter | DeepSeek) выбирается env LLM_PROVIDER;
                  debugCapture — in-memory перехват RAW-запросов к LLM для экрана отладки
  handlers/     — обработчики команд/кнопок бота (index = registerHandlers, start.ts,
                  photoActions.ts — callback «Закрыть» под фото из лайтбокса)
  server/       — Hono HTTP API: index=startServer, routes.ts, initData.ts (валидация подписи),
                  CRUD-роуты (characters/personas/presets/chats), messageHandlers +
                  impersonateHandlers (стриминговая RP-генерация по SSE), promptBuilder,
                  translate (Google Translate + ИИ-перевод по промпту пресета), profilePhoto,
                  photoToChat (POST /me/send-photo — бот шлёт фото из лайтбокса юзеру в чат
                  с web_app-кнопкой deep-link на персонажа/персону + «Закрыть»),
                  debug (GET/PATCH/DELETE /debug/llm — RAW-запросы к LLM и настройки перехвата)
                  + раздача собранной статики Mini App из ./public (SPA-fallback) — один процесс
  scripts/      — разовые скрипты (backfill-message-encryption)
  utils/        — retry, crypto (per-user шифрование сообщений)

webapp/src/
  main.tsx      — точка входа: initTelegram() + рендер <App/>
  init.ts       — инициализация @telegram-apps SDK (защищённая) + initData.restore()
  app/          — оболочка: App.tsx (AppRoot + HashRouter), routes.ts, BackButtonBridge
  pages/        — экраны-маршруты (один на маршрут): home/ characters/ personas/
                  generation-presets/ rp-chat/
  shared/       — кросс-каттинг: telegram/ (initData, confirm, profile photo), api/ (client с
                  Authorization), text/, image/, components/ (AvatarPicker, ImageCropEditor,
                  ImageLightbox, PageTransition)
  features/<feature>/  — доменный модуль, разложенный по подпапкам-категориям + barrel index.ts.
                  Фичи: characters, personas, generation-presets, rp-chat, debug (экран RAW-запросов к LLM).
                  index.ts    — публичная поверхность фичи (то, что нужно страницам)
                  api/        — обёртки над apiFetch (граница к /api), доменные файлы (НЕ один barrel)
                  hooks/      — React-хуки фичи
                  components/ — .tsx-компоненты (+ фичевый .css рядом, если есть)
                  types/      — типы фичи (один файл с доменным именем, напр. character.ts)
                  lib/        — чистые хелперы и данные (форматтеры, спеки, парсеры, mock)
                  (категории без файлов не заводим)
```

### Структура webapp — pages vs features
- **`pages/<screen>/`** — цель маршрута, по одной на `ROUTES.*`. Тонкая обёртка, собирающая фичи.
- **`features/<feature>/`** — самодостаточный доменный модуль (UI + логика): `characters`, `generation-presets`,
  `rp-chat`, далее `prompts`, `translator`.
- **Раскладка фичи по категориям — mandatory.** Внутри фичи файлы лежат в подпапках `api/ hooks/ components/
  types/ lib/` (см. дерево выше), а не россыпью в корне. Категории без файлов не создаём.
- **Barrel `index.ts` на фичу.** У каждой фичи `index.ts` реэкспортирует **только публичную поверхность**
  (то, что потребляют страницы/`App`); внутренние под-компоненты в barrel не выносим. Потребители импортируют
  фичу как модуль: `import { CharacterForm, useCharacter } from "../../features/characters"`.
- **Внутрифичевые импорты — напрямую к файлам, НЕ через свой barrel** (`../types/character`, `../api/...`):
  импорт собственного `index.ts` создаёт цикл, который компилируется, но даёт `undefined` в рантайме.
- **`shared/`** — только переиспользуемое между фичами: `api/client.ts` (граница к `/api`), `telegram/`
  (доступ к SDK), `text/` (`estimateTokens`, `initials`), `image/` (`buildAvatarImages` — из выбранного
  кропа делает квадратную миниатюру + уменьшенное полное фото), `components/` (`AvatarPicker` — выбор/превью/
  удаление аватара с кропом миниатюры через `ImageCropEditor` на `react-easy-crop`), `toast/` (`ToastProvider` +
  `useToast` — переиспользуемые уведомления на tgui `Snackbar`; провайдер обёрнут вокруг приложения в `App`,
  Snackbar рендерится порталом в `body` с `z-index` выше лайтбокса). Новую папку заводим, когда сущность реально появилась, а не заранее.
- **Роутер — `HashRouter`** (react-router-dom): маршрут в hash переживает reload. Нативная кнопка «Назад» Telegram связана с роутером в `app/BackButtonBridge.tsx` (`navigate(parentPath(...))` — вверх по иерархии, а не по истории). Catch-all `*` → главная: на Telegram Web launch-параметры приходят в hash, и без редиректа роутер показал бы пустой экран.
- **Deep-link из бота** (`app/deepLink.ts` + `main.tsx`): web_app-кнопка под фото из лайтбокса открывает Mini App с `?dl=<путь>` (напр. `/characters/123`). `resolveDeepLink()` вызывается **до** `render()` (после `initTelegram()`, который уже считал launch-данные из hash) и переписывает hash на маршрут — иначе catch-all успел бы увести на главную. Делать это в компоненте внутри роутера НЕЛЬЗЯ: эффект `<Navigate>` из catch-all в том же flush перебьёт переход.

### Narrator-режим («Режиссёр истории») — invariant
Второй режим игры: ИИ ведёт повествование между персонажами, пользователь — режиссёр (направляет
**директивами**, не отыгрывает роль). Сделан **новыми** доменными таблицами/модулями (не поверх
RP-чата), переиспользуя только реально переиспользуемое (шифрование, LLM-клиент, SSE-стриминг, чистые
хелперы `promptBuilder`).

- **БД:** `knowledge_books` + `knowledge_book_entries` (lorebook: запись = ссылка на персонажа **или**
  свободный текст; `activation` поэлементная `always_on|keyword`, keyword — задел), `narrator_templates`
  (промпты нарратора: `systemPrompt` + `auxiliarySystemPrompt` + `postHistoryInstruction` + `promptOrder`
  — порядок/включённость 6 компонентов `system|premise|lorebook|auxiliary|history|postHistory`, зеркало
  пресета; сэмплинг по-прежнему из `generation_presets`), `story_chats`
  (`openingBeat` **обязателен** — дословный бит 1; `premise` опц.; `bookId`/`templateId`/`presetId`
  **обяз.**, FK без onDelete = restrict → удаление используемого шаблона/пресета даёт 409 in_use)
  + `story_messages` (дерево, `kind: beat|continue|directive`; `translations` — JSON-кэш переводов,
  зашифрован per-user, как у `messages`) + `story_settings` (перевод истории, зеркало `chat_settings`).
- **Сервер:** `db/knowledge/`, `db/narratorTemplates.ts`, `db/stories/` (зеркало `db/chats/`,
  вкл. `settings.ts` и `crypto.ts` — расшифровка кэша переводов); `server/storyPromptBuilder.ts` (+тест),
  `server/storyHandlers.ts` (вкл. перевод бита/директивы через `googleTranslate`), роуты
  `books`/`narrator-templates`/`stories` (у `stories` — `settings` GET/PUT + `messages/:id/translate`).
- **Webapp:** фичи `narrator`/`knowledge-books`/`narrator-templates`, страницы `pages/narrator/*`,
  `pages/knowledge-books/*`, `pages/narrator-templates/*`; кнопки на главной (Режим игры + Библиотека).
  Перевод истории — раздел в `StorySettingsPage` + кнопка-Globe на битах/директивах в ленте
  (`useStorySettings`/`useTranslatable`), зеркало RP-чата. Редактор шаблона (`TemplateForm`) — поля
  промптов + блок «Порядок промптов». Кросс-фичевые компоненты в `shared/components`: `ExpandableSelect`
  (настройки перевода RP и narrator) и `PromptOrderEditor` (дженерик-редактор порядка промптов с пропсами
  `labels`/`sources`/`unimplemented` — используют пресеты ИИ и narrator-шаблоны; у каждой фичи свои карты
  подписей/источников и `DEFAULT_*_PROMPT_ORDER`).

**Ключевой инвариант сборки промпта** (`storyPromptBuilder.buildStoryMessages`): отыгранные user-ходы
(директивы/continue) **нейтрализуются** в `CONTINUE_MARKER`, кроме последнего (живого триггера) — их
последствие уже в тексте следующего бита, повторно инструктировать нельзя. Перед корнем (openingBeat —
`assistant`) вставляется синтетический leading-user — иначе массив начинался бы с assistant, что отвергают
Anthropic (через OpenRouter) и reasoner DeepSeek. Книга знаний: в MVP в промпт идут только `always_on`-записи.

Сборка идёт **итерацией по `promptOrder` шаблона** (как `promptBuilder.buildMessages` у RP): выключенные/
пустые компоненты пропускаются; все non-history части → отдельным сообщением role `system`; `history` →
leading-user + нейтрализованный путь. Leading-user и нейтрализация — свойства **блока history**, поэтому
позиция в порядке их не ломает. `resolveHistory` (бюджет обрезки) суммирует **все включённые non-history**
компоненты и зовётся, только если `history` включён. Дефолт порядка (`DEFAULT_NARRATOR_PROMPT_ORDER` в
`storyPromptBuilder.ts`, зеркалится в webapp): `system, lorebook, auxiliary, premise, history, postHistory`,
где `postHistory` выключен. Фолбэк (история без шаблона) — этот же дефолт + `DEFAULT_NARRATOR_TEMPLATE`.

### Прокси для Telegram — invariant
Прокси (`TELEGRAM_PROXY_URL`) задаётся `https-proxy-agent` (`HttpsProxyAgent`) и подключается **только**
к grammY-клиенту (`bot.ts` → `client.baseFetchConfig.agent`). Так через прокси идёт исключительно
трафик к Telegram. **Никогда** не использовать глобальный прокси (env `HTTPS_PROXY` / `ALL_PROXY`) —
это увело бы через прокси и OpenRouter.

⚠️ grammY в Node использует **node-fetch@2** (не нативный fetch!), который проксируется через option
`agent`. undici `dispatcher` он **игнорирует** — хотя тип `baseFetchConfig` выведен из нативного fetch
и обманчиво подсказывает `dispatcher`. Проверено рантайм-тестом: с `agent` getMe доходит до Telegram,
с `dispatcher` — уходит напрямую в обход прокси. Отсюда каст в `bot.ts`.

### Mini App API — boundary
Ключ OpenRouter — **только серверно** (`bot/src/llm`), в браузер не попадает. RP-генерация идёт через
HTTP API бота (`server/`), а не напрямую из webapp.

Запросы webapp → `/api/*` несут подписанный Telegram `initData` в заголовке `Authorization: tma <initData>`
(webapp: `shared/api/client.ts`). Сервер (`server/initData.ts`) **проверяет HMAC-подпись** по `BOT_TOKEN`
через **`@tma.js/init-data-node`** (`validate` бросает при подделке/просрочке, `parse` достаёт юзера в
`c.get("tgUser")`). Без подписи: в проде → 401, в dev → пропускаем (отладка webapp из браузера).

⚠️ Серверный пакет — **`@tma.js/init-data-node`**, НЕ `@telegram-apps/init-data-node` (последний deprecated).
Это противоположно выбору org для **webapp** (там `@telegram-apps/*` — см. README/стек): не «чинить» ради
единообразия. По умолчанию `validate` считает initData просроченным через сутки (`expiresIn` = 86400) —
учесть, когда у `apiFetch` появятся реальные вызовы (долгая сессия webview даст 401).

## Деплой

Прод — **один Docker-контейнер** на сервере (`https://miniapp.aoshi.ru`): тот же процесс Node раздаёт
и HTTP API, и собранную статику Mini App (webapp вшит в образ). `Dockerfile` лежит **в корне**, контекст
сборки — корень монорепо (`docker build -f Dockerfile .`).

**CI/CD:** пуш в ветку **`deploy`** запускает GitHub Action (`.github/workflows/deploy.yml`), который
собирает образ **на демоне сервера** через docker context (SSH), без реестра (GHCR не используется),
и перезапускает контейнер по `docker-compose.yml` (он лежит на сервере, в репо — справочная копия).
Подробности инфраструктуры сервера — в auto-memory `server-deploy-setup`.

### Команда «Задеплой»
Когда пользователь пишет «Задеплой» (или просит задеплоить) — выполни строго по шагам:
1. **Гейт проверок.** Весь гейт (тесты + сборка) делегируй субагенту **`test-runner`** (Agent tool,
   `subagent_type: test-runner`) — он в одном запуске гоняет `yarn test`, затем `yarn build`, разбирает
   падения и возвращает единый вердикт. Это обязательный гейт деплоя: запускай его **без отдельной просьбы**
   пользователя. Если агент сообщает о падении тестов или ошибке сборки — **СТОП**, не пушим, показать его
   диагноз пользователю. Дальше идём только при зелёном вердикте.
2. **Запомнить исходную ветку:** `git branch --show-current` — с неё деплоим и на неё вернёмся в конце.
3. **Залить на `deploy` и запушить:** `git checkout deploy` → `git merge --ff-only <исходная>` →
   `git push origin deploy`. Пуш в `deploy` триггерит автодеплой на сервер.
4. **Вернуться на исходную ветку:** `git checkout <исходная>`.

Изменения должны быть **закоммичены** на исходной ветке до деплоя — `--ff-only` переносит на `deploy`
именно коммиты. Если fast-forward невозможен (ветки разошлись) — не делать merge-коммит молча,
сообщить пользователю и спросить, как поступить.

## Структура и размер файлов — mandatory
Чтобы файлы не разрастались и проект оставался читаемым/масштабируемым:
- **Один файл — одна обязанность.** «Главный» файл (entry-point, register-агрегатор, цикл воркера) держим тонким, вынося реализацию в соседние файлы той же папки.
- **Ориентир ~100–150 строк.** Файл за ~150 строк — сигнал, что в нём несколько обязанностей; разбей, если они отделимы. Это эвристика читаемости, **не** жёсткий лимит: когезивные single-responsibility файлы (данные/строки, одиночный хендлер, DAO одной таблицы) не дробим ради цифры.
- **Папка-фича вместо россыпи.** Когда сущность вырастает из одного файла — заводим папку с `index.ts`-агрегатором (barrel или `registerXxx`) и соседними файлами-реализациями.
- **Со-локация констант/типов.** Фичевые константы/типы лежат рядом с использованием (`<feature>/constants.ts`, `<feature>/types.ts`), а не в общем barrel. В `src/constants/`/`src/types/` оставляем только кросс-каттинговое.
- **Новый фоновый воркер / внешний источник** — только папкой (`worker.ts` + `client.ts` + `types.ts` + `constants.ts`); экспортирует функцию запуска воркера, которая подключается одной строкой в `index.ts`.

## Code conventions

### Logging — mandatory
Every new module that does external I/O (API calls, DB writes, Telegram API) **must**:
1. Import `logger` from `../logger` (adjust path as needed)
2. Log the start or key parameters at `debug` or `info`
3. Measure duration: `const t0 = Date.now()` before the call, `durationMs: Date.now() - t0` in the log after
4. Log completion with timing and relevant metadata (token counts for LLM calls, row counts for DB ops, `dims` for embeddings)
5. Log errors with `logger.error({ err, ...context }, "description")` — never swallow silently

Pattern from existing code:
```typescript
const t0 = Date.now();
const result = await externalCall(...);
logger.info({ durationMs: Date.now() - t0, ...relevantFields }, "Operation completed");
```

### Error handling — mandatory
- Every new `async` function must either propagate errors to its caller or catch and log them explicitly
- Fire-and-forget chains (`.then().catch()`) must always end with `.catch((err) => logger.warn({ err, ...ctx }, "what failed"))`
- Never use an empty `catch {}` block — always log at minimum
- For handlers: unexpected errors should be logged with `logger.error` and result in a user-facing reply
- **Exception — group handlers**: on error, log with `logger.error` but do **not** send a user-facing reply. The bot is one of many participants in a shared chat, so surfacing every internal error would spam the group. Errors stay in the logs only.

### Comments — encouraged
Add comments freely, especially in places with non-trivial logic. Preferred spots:
- Complex conditionals or multi-step flows — explain the intent
- Non-obvious constraints or invariants
- Workarounds for external API quirks
- Any place where a reader might ask "why is this done this way?"

All comments must be written in **Russian**.

Still avoid restating what the code obviously does — focus on the **why**, not the **what**.

### DB schema changes
1. Edit `src/db/schema.ts`
2. Run `yarn drizzle-kit generate` to create migration SQL in `drizzle/`
3. For pgvector extensions: manually add `CREATE EXTENSION IF NOT EXISTS vector;` to the migration — drizzle-kit does not generate it
4. Run `yarn drizzle-kit migrate` to apply

### Testing — vitest
Test runner is **vitest** в **обоих** workspace (`bot/` и `webapp/`), у каждого свой `vitest.config.ts`
(pool `forks`). Корневой `yarn test` гоняет оба пакета по очереди; `yarn test:watch` — только bot.
- **Co-locate** tests next to the code as `*.test.ts` (same folder, e.g. `transform.ts` → `transform.test.ts`). The runner globs `src/**/*.test.ts`. В `bot/` `tsc` (`yarn build`) исключает тесты через `**/*.test.ts` в `tsconfig.json`, так что они не попадают в `dist/`; в `webapp/` сборка `noEmit` (vite бандлит только импортируемое), поэтому тесты не нужно исключать.
- **webapp:** импорты в тестах — **без** `.js` (bundler resolution); чистую логику изолируем от Telegram SDK
  (напр. SSE-парсер `parseSSE.ts` вынесен из `sse.ts`, чтобы тест не тянул `@telegram-apps/sdk-react`).
- **What to test:** pure functions — transformers, formatters, parsers, retry/decision logic — the stuff with no I/O. Workers, DAOs (`db/*`), and Telegram/LLM handlers are **not** unit-tested (they need a live DB / external services / mutable module state).
- **Imports still need `.js`** in test files too (native ESM). Vitest/Vite resolves the `.js` specifier to the `.ts` source automatically.
- **Avoid pulling in `config`/`logger` transitively.** A unit under test that imports `../logger.js` will drag in `config.ts` (which `requireEnv`s `BOT_TOKEN` etc. and would throw without a `.env`) plus pino-roll worker threads. Mock it: `vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))`.
- **Pool is `forks`** (not the default threads): on Windows the thread pool + Vite's cold dep-optimizer occasionally fails the first run. Forks make cold runs deterministic — keep it.
- **`vite` is an explicit `devDependency`** even though nothing in `src/` imports it. In **vitest 4 Vite is a `peerDependency`**, so it must be installed by the project, not relied on as a transitive leftover. If it's missing/mis-linked, the whole suite fails on *every* file with `TypeError: Cannot read properties of undefined (reading 'config')`. Fix: `yarn install`; the explicit pin keeps it from recurring. Keep `vite`'s major within vitest's peer range (`^6 || ^7 || ^8`).
- **Adding new pure logic?** Add a `*.test.ts` beside it.

## External APIs

| Service | Used for | Key env var |
|---|---|---|
| Telegram | Bot API (через HTTP-прокси) | `BOT_TOKEN`, `TELEGRAM_PROXY_URL` |
| OpenRouter | LLM (chat completion), серверно | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |
| DeepSeek | LLM (chat completion), серверно | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` |
| Postgres | БД (drizzle) | `DATABASE_URL` |

**Выбор LLM-провайдера** — глобально через env `LLM_PROVIDER` (`openrouter` | `deepseek`, дефолт
`openrouter`). Оба OpenAI-совместимы, поэтому `bot/src/llm/client.ts` общий, а различия (base URL,
ключ, app-заголовки, дефолтная модель, формат reasoning) вынесены в `bot/src/llm/providers.ts`
(`getActiveProvider()`). **Инвариант:** тело запросов OpenRouter не меняем — это запасной путь;
reasoning («мышление» из пресета, поля `requestReasoning`/`reasoningEffort`) применяется только для
DeepSeek (`thinking`-режим), для OpenRouter `reasoningBody` возвращает `{}`.

## Keeping docs up to date

Оба файла отражают **текущее состояние** проекта, не историю: что убрали из кода — убираем и из доков.
- **README.md** — при изменениях, важных новому разработчику: новая внешняя зависимость/сервис, новые
  шаги установки (env-переменные, миграции, требуемый тулинг), крупная фича, устаревший раздел стека.
- **CLAUDE.md** (этот файл) — при изменениях процесса/конвенций: новый архитектурный паттерн или тип
  модуля, новый внешний API/модель, новое mandatory-правило, значимое изменение структуры проекта.

## Key patterns

**Retry wrapper** — use for all external calls that can transiently fail:
```typescript
await retry(() => someApiCall(), 3, 1500, "Label");
// or with custom shouldRetry:
await retry(() => call(), 3, 1500, "Label", (err) => !(err instanceof NonRetryableError));
```

**Fire-and-forget** — for non-blocking background work:
```typescript
someAsyncWork()
  .then((result) => logger.info({ result }, "Background work done"))
  .catch((err) => logger.warn({ err }, "Background work failed"));
```

**Processing lock** — use a `Set<string>` keyed by a unique context key (e.g. `"chatId:threadId"`) to reject concurrent requests from the same context. Lock must always be released in `finally`:
```typescript
const key = `${chatId}:${threadId}`;
if (processing.has(key)) return;
processing.add(key);
try {
  // ...
} finally {
  processing.delete(key);
}
```
