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
  proxy.ts      — undici ProxyAgent (dispatcher) ТОЛЬКО для Telegram
  db/           — drizzle: schema.ts + клиент (postgres.js, ленивое подключение)
  llm/          — OpenRouter client (client/types/constants) — серверно, ключ не уходит в браузер
  handlers/     — обработчики команд (index = registerHandlers, start.ts …)
  server/       — Hono HTTP API (index=startServer, routes.ts, initData.ts — валидация подписи)
                  + раздача собранной статики Mini App из ./public (SPA-fallback) — один процесс
  utils/        — retry и пр.

webapp/src/
  main.tsx      — точка входа: initTelegram() + рендер <App/>
  init.ts       — инициализация @telegram-apps SDK (защищённая) + initData.restore()
  app/          — оболочка: App.tsx (AppRoot + HashRouter), routes.ts, BackButtonBridge
  pages/        — экраны-маршруты (один на маршрут): home/ …
  shared/       — кросс-каттинг: telegram/ (доступ к initData), api/ (client с Authorization)
  features/<feature>/  — доменный модуль, разложенный по подпапкам-категориям + barrel index.ts:
                  index.ts    — публичная поверхность фичи (то, что нужно страницам)
                  api/        — обёртки над apiFetch (граница к /api)
                  hooks/      — React-хуки фичи
                  components/ — .tsx-компоненты (+ фичевый .css рядом, если есть)
                  types/      — типы фичи (один файл с доменным именем, напр. character.ts)
                  lib/        — чистые хелперы и данные (форматтеры, спеки, mock)
                  (категории без файлов не заводим: у rp-chat нет api/ и hooks/)
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
  (доступ к SDK), `text/` (`estimateTokens`, `initials`), `image/` (`fileToAvatarDataUrl` — кроп/даунскейл аватара),
  `components/` (`AvatarPicker` — выбор/превью/удаление аватара). Новую папку заводим, когда сущность реально появилась, а не заранее.
- **Роутер — `HashRouter`** (react-router-dom): маршрут в hash переживает reload и оставляет задел под deep-link через `start_param`. Нативная кнопка «Назад» Telegram связана с роутером в `app/BackButtonBridge.tsx` (`navigate(parentPath(...))` — вверх по иерархии, а не по истории). Catch-all `*` → главная: на Telegram Web launch-параметры приходят в hash, и без редиректа роутер показал бы пустой экран.

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
1. **Проверки.** Из корня: `yarn test`, затем `yarn build`. Если хоть что-то упало — **СТОП**, не пушим,
   показать ошибку пользователю.
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
Test runner is **vitest** (`yarn test` = `vitest run`, `yarn test:watch` = watch mode). Config: `vitest.config.ts`.
- **Co-locate** tests next to the code as `*.test.ts` (same folder, e.g. `transform.ts` → `transform.test.ts`). The runner globs `src/**/*.test.ts`; `tsc` (`yarn build`) excludes them via `**/*.test.ts` in `tsconfig.json`, so tests never land in `dist/`.
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
| Postgres | БД (drizzle) | `DATABASE_URL` |

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
