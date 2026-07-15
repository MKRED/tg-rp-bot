# tg-rp-bot — Claude Code Instructions

## Советник (advisor) — mandatory
**ВСЕГДА**, когда нужен совет по чему-либо, связанному с разработкой (выбор подхода/архитектуры,
сомнение между вариантами, неочевидное решение, оценка компромиссов, «как правильно сделать X»),
вызывай субагента **`advisor`** (Agent tool, `subagent_type: advisor`, модель opus). Он консультирует
и рассуждает, код не правит. Не полагайся только на собственное суждение в сложных моментах —
сначала спроси совета у `advisor`.

### Субагенты проекта (`.claude/agents/`)
Специализированные агенты — используй их вместо ручной работы, когда задача под них подходит:

| Агент | Когда звать | Правит код? |
|---|---|---|
| **`advisor`** | Совет по архитектуре/подходу (см. выше — **mandatory**) | нет |
| **`test-runner`** | Гейт тестов+сборки перед коммитом/деплоем (см. «Задеплой» — **mandatory** там) | да, по запросу |
| **`code-reviewer`** | Ревью текущего диффа перед коммитом (конвенции + корректность) | нет |
| **`docs-updater`** | Актуализация README/CLAUDE.md после заметных правок кода | да |
| **`bug-investigator`** | Найти корень бага по симптому (трассировка + прод-логи) | нет |
| **`codebase-explorer`** | «Где у меня X / как устроено Y» без дампа файлов в контекст | нет |
| **`log-analyzer`** | Разбор прод-логов бота из Docker по SSH | нет |
| **`dep-auditor`** | Аудит зависимостей (уязвимости, устаревшее) | нет |
| **`web-researcher`** | Свежая инфа извне (доки библиотек, API, модели OpenRouter) | нет |

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

**Окружение разработки — Windows** (shell — Git Bash / POSIX sh). Не предлагай unix-only команды
(`pkill`, `lsof`, `kill $(...)`); стоп бота — `Stop-Process -Name "node"` (PowerShell).

```
yarn dev           # start bot (= yarn workspace bot dev) — run in background
yarn dev:web       # start Mini App (Vite dev server)
Stop-Process -Name "node"  # stop bot
yarn workspace bot drizzle-kit generate  # generate migration from schema changes
yarn workspace bot drizzle-kit migrate   # apply migrations to DB
yarn test          # run bot + webapp unit tests once (vitest run)
yarn test:watch    # run bot tests in watch mode
cd bot && yarn vitest run src/path/file.test.ts   # один файл (отладка); webapp — cd webapp
yarn build         # build bot + webapp
```

**Env:** локальные переменные — `bot/.env` (шаблон `bot/.env.example`), обязательны `BOT_TOKEN` +
`DATABASE_URL`. Без `.env` падает `config.ts` (`requireEnv`) — отсюда правило про мок `logger` в тестах.

## Architecture — карта верхнего уровня

> 📘 **Полный инвентарь дерева** (`bot/src`, `webapp/src`, раскладка фичи) + детали границ
> (прокси Telegram, Mini App API) — см. [docs/architecture.md](docs/architecture.md).

```
bot/src/    — index (thin entry) · bot.ts (grammY) · config · logger · proxy · db/ (drizzle DAO
              по таблицам) · llm/ (LLM client, провайдер по env) · handlers/ · server/ (Hono API +
              раздача статики Mini App) · utils/ (retry, crypto)
webapp/src/ — main/init (Telegram SDK) · app/ (оболочка, HashRouter) · pages/ (экран на маршрут) ·
              features/ (доменные модули) · shared/ (кросс-каттинг)
```

Домены bot и webapp зеркалят друг друга: characters, personas, generation-presets, rp-templates,
rp-chat, narrator, knowledge-books, narrator-templates, debug.

### Структура webapp — pages vs features
> 📘 **Стили и режимы Mini App** — Telegram UI (tgui), темы/платформы, viewport, safe area,
> compact/full-screen, mobile vs desktop: см. [docs/telegram-ui.md](docs/telegram-ui.md).
> Свериться с ним перед правкой UI webapp или обновлением tgui/SDK.

- **`pages/<screen>/`** — цель маршрута, по одной на `ROUTES.*`. Тонкая обёртка, собирающая фичи.
- **`features/<feature>/`** — самодостаточный доменный модуль (UI + логика).
- **Раскладка фичи по категориям — mandatory.** Внутри фичи файлы лежат в подпапках `api/ hooks/ components/
  types/ lib/`, а не россыпью в корне. Категории без файлов не создаём. (Дерево — в docs/architecture.md.)
- **Barrel `index.ts` на фичу.** У каждой фичи `index.ts` реэкспортирует **только публичную поверхность**
  (то, что потребляют страницы/`App`); внутренние под-компоненты в barrel не выносим. Потребители импортируют
  фичу как модуль: `import { CharacterForm, useCharacter } from "../../features/characters"`.
- **Внутрифичевые импорты — напрямую к файлам, НЕ через свой barrel** (`../types/character`, `../api/...`):
  импорт собственного `index.ts` создаёт цикл, который компилируется, но даёт `undefined` в рантайме.
- **`shared/`** — только переиспользуемое между фичами (`api/client.ts` — граница к `/api`, `telegram/`,
  `text/`, `image/`, `components/`, `toast/`, …). Новую папку заводим, когда сущность реально появилась.
- **Роутер — `HashRouter`** (react-router-dom): маршрут в hash переживает reload. Нативная кнопка «Назад» Telegram связана с роутером в `app/BackButtonBridge.tsx` (`navigate(parentPath(...))` — вверх по иерархии, а не по истории). Catch-all `*` → главная: на Telegram Web launch-параметры приходят в hash, и без редиректа роутер показал бы пустой экран.
- **Deep-link из бота** (`app/deepLink.ts` + `main.tsx`): web_app-кнопка под фото из лайтбокса открывает Mini App с `?dl=<путь>` (напр. `/characters/123`). `resolveDeepLink()` вызывается **до** `render()` (после `initTelegram()`, который уже считал launch-данные из hash) и переписывает hash на маршрут — иначе catch-all успел бы увести на главную. Делать это в компоненте внутри роутера НЕЛЬЗЯ: эффект `<Navigate>` из catch-all в том же flush перебьёт переход.

## Инварианты и границы (trap-предупреждения)

> 📘 Подробности «почему и как устроено» — в docs. Здесь — короткие правила, которые нельзя нарушить.

- **Прокси только для Telegram.** `TELEGRAM_PROXY_URL` цепляется исключительно к grammY-клиенту
  (`bot.ts` → `baseFetchConfig.agent`). НИКОГДА не ставить глобальный прокси (`HTTPS_PROXY` / `ALL_PROXY`) —
  уведёт через прокси и трафик к OpenRouter. Почему `agent`, а не `dispatcher` (node-fetch@2 quirk) —
  [docs/architecture.md](docs/architecture.md).
- **Ключ OpenRouter — только серверно** (`bot/src/llm`), в браузер не попадает; RP-генерация идёт через
  HTTP API бота, а не напрямую из webapp. Запросы webapp → `/api/*` несут подписанный `initData`
  (`Authorization: tma …`), сервер проверяет HMAC. Пакет валидации — **`@tma.js/init-data-node`**
  (НЕ `@telegram-apps/*`), детали — [docs/architecture.md](docs/architecture.md).
- **Narrator: массив промпта не может начинаться с `assistant`.** Перед корнем (openingBeat) вставляется
  синтетический leading-user; отыгранные user-ходы нейтрализуются в `CONTINUE_MARKER` (кроме последнего).
  На эти грабли легко наступить при правке `storyPromptBuilder` — полный нарратив режима «Режиссёр истории»
  и сжатия (compact): [docs/narrator.md](docs/narrator.md).

## Git — коммиты
Коммиты — **Conventional Commits** с русским описанием: `type(scope): краткое описание`.
- Типы: `feat` / `fix` / `chore` / `refactor` / `docs` / `test`.
- Scope — домен/пакет: `webapp`, `knowledge`, `agents`, `bot`, `server`, … (по затронутой области).
- Пример: `fix(webapp): кнопка перевода первой в строке действий RP-чата`.
Ветки: `main` (основная) и `deploy` (триггер автодеплоя, см. ниже). Коммить/пуш — только по явной
просьбе пользователя; если правки на `main`, сперва заводи ветку.

## Деплой
Прод — один Docker-контейнер, раздаёт HTTP API и статику Mini App одним процессом. Инфраструктура
(Docker, CI/CD по ветке `deploy`) — [docs/deploy.md](docs/deploy.md).

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

**Откат:** drizzle-kit — forward-only, команды `migrate:down` нет. Ещё **не применённую** миграцию
убираем через `yarn workspace bot drizzle-kit drop` (снимает последнюю из журнала) + удаляем `.sql`.
**Уже применённую** назад не откатываем автоматически — пишем новую корректирующую миграцию
(`generate` → правим SQL → `migrate`). Ломающие изменения на проде — только через forward-миграцию.

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

Все доки отражают **текущее состояние** проекта, не историю: что убрали из кода — убираем и из доков.
- **README.md** — при изменениях, важных новому разработчику: новая внешняя зависимость/сервис, новые
  шаги установки (env-переменные, миграции, требуемый тулинг), крупная фича, устаревший раздел стека.
- **CLAUDE.md** (этот файл) — при изменениях процесса/конвенций: новый архитектурный паттерн или тип
  модуля, новый внешний API/модель, новое mandatory-правило, значимое изменение структуры проекта.
- **docs/** — справочные нарративы: `architecture.md` (инвентарь дерева + границы прокси/Mini App),
  `narrator.md` (режим «Режиссёр истории» + compact), `deploy.md` (инфра), `telegram-ui.md` (стили tgui).
  Правишь фичу — обнови соответствующий файл; в CLAUDE.md держим только тонкую ссылку.

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
