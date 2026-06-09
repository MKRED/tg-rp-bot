# tg-rp-bot

Telegram-бот для ролевой игры (RP) с упором на **Telegram Mini Apps** и AI-генерацией через **OpenRouter**.

## Стек

| Слой | Технологии |
|---|---|
| Монорепо | Yarn workspaces (`bot`, `webapp`) |
| Бот | Node 24 (native ESM, TypeScript), [grammY](https://grammy.dev) |
| HTTP API | [Hono](https://hono.dev) + `@hono/node-server` |
| БД | Postgres + [drizzle-orm](https://orm.drizzle.team) / drizzle-kit |
| LLM | OpenRouter (OpenAI-совместимый API) |
| Логи | pino (+ pino-roll, pino-pretty) |
| Mini App | React 19 + Vite + `@telegram-apps/sdk-react` + `@telegram-apps/telegram-ui` |
| Тесты | vitest |

## Структура

```
tg-rp-bot/
├─ package.json        # корень workspaces + сквозные скрипты
├─ Dockerfile          # единый образ: бот + API + статика Mini App (контекст сборки — корень)
├─ docker-compose.yml  # запуск контейнера на сервере (справочная копия; рабочая лежит на сервере)
├─ .github/workflows/  # deploy.yml — автодеплой по пушу в ветку deploy
├─ bot/                # Telegram-бот + HTTP API для Mini App
│  ├─ src/
│  │  ├─ index.ts      # точка входа: регистрация хендлеров, старт сервера и бота
│  │  ├─ bot.ts        # инстанс grammY (+ прокси для Telegram)
│  │  ├─ config.ts     # переменные окружения
│  │  ├─ logger.ts     # pino
│  │  ├─ proxy.ts      # undici ProxyAgent только для Telegram
│  │  ├─ db/           # drizzle: schema + клиент
│  │  ├─ llm/          # клиент OpenRouter
│  │  ├─ handlers/     # обработчики команд (/start …)
│  │  ├─ server/       # Hono HTTP API (/health, /api) + раздача статики Mini App + seam initData
│  │  └─ utils/        # retry и пр.
│  └─ drizzle/         # SQL-миграции
└─ webapp/             # Mini App (React + Vite)
   └─ src/
      ├─ main.tsx      # точка входа + init Telegram SDK
      ├─ App.tsx       # AppRoot (тема Telegram)
      └─ features/rp-chat/  # экран RP-чата
```

## Прокси для Telegram

Запросы **только к Telegram Bot API** проходят через локальный HTTP-прокси (`TELEGRAM_PROXY_URL`,
например `http://127.0.0.1:8080`, без авторизации). Реализовано через undici `ProxyAgent`,
который подключается исключительно к grammY-клиенту — OpenRouter и любые другие запросы идут напрямую.

## Запуск

Требуется **Node ≥ 24** и доступный Postgres.

```bash
yarn install                      # установка всех workspace-зависимостей

cp bot/.env.example bot/.env      # заполни BOT_TOKEN, DATABASE_URL, при необходимости прокси/ключи

yarn workspace bot drizzle-kit migrate   # применить миграции БД

yarn dev          # старт бота (= yarn workspace bot dev)
yarn dev:web      # старт Mini App (Vite dev server)
```

### Полезные команды

```bash
yarn build                                  # сборка bot + webapp
yarn test                                   # юнит-тесты бота (vitest)
yarn workspace bot drizzle-kit generate     # сгенерировать миграцию из изменений схемы
yarn workspace bot drizzle-kit migrate      # применить миграции
```

## Переменные окружения

См. [`bot/.env.example`](bot/.env.example). Обязательные: `BOT_TOKEN`, `DATABASE_URL`.

## Деплой

Прод — **один Docker-контейнер** на сервере (`https://miniapp.aoshi.ru`): один процесс Node раздаёт
и HTTP API, и собранную статику Mini App (webapp вшит в образ при сборке). TLS терминирует edge-nginx
сервера и проксирует поддомен в контейнер.

- **Образ** собирается из [`Dockerfile`](Dockerfile) в корне (multi-stage: ставит зависимости монорепо,
  собирает `bot` через `tsc` и `webapp` через `vite`, кладёт статику в `bot/public`).
- **CI/CD:** пуш в ветку **`deploy`** запускает GitHub Action ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)),
  который собирает образ **на демоне сервера** через docker context (SSH, без реестра) и перезапускает
  контейнер по серверному `docker-compose.yml`.

Ручная сборка из корня репозитория:

```bash
docker build -f Dockerfile -t kvach_tg_rp_bot .
docker compose up -d --force-recreate bot
```
