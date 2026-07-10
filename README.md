# tg-rp-bot

Telegram-бот для ролевой игры (RP) с упором на **Telegram Mini Apps** и AI-генерацией через **OpenRouter**.

## Стек

| Слой | Технологии |
|---|---|
| Монорепо | Yarn workspaces (`bot`, `webapp`) |
| Бот | Node 24 (native ESM, TypeScript), [grammY](https://grammy.dev) |
| HTTP API | [Hono](https://hono.dev) + `@hono/node-server` |
| БД | Postgres + [drizzle-orm](https://orm.drizzle.team) / drizzle-kit |
| LLM | OpenRouter / DeepSeek (OpenAI-совместимый API, выбор через `LLM_PROVIDER`) |
| Логи | pino (+ pino-roll, pino-pretty) |
| Mini App | React 19 + Vite + `@telegram-apps/sdk-react` + `@telegram-apps/telegram-ui` + `react-router-dom` (HashRouter) + `@xyflow/react` (граф диалога) + `framer-motion` + `react-easy-crop` (кроп аватара) |
| initData | подпись проверяется серверно через `@tma.js/init-data-node` |
| Прокси | `https-proxy-agent` (HttpsProxyAgent, CONNECT-туннель) — только для Telegram |
| Тесты | vitest (bot + webapp) |

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
│  │  ├─ proxy.ts      # HttpsProxyAgent (https-proxy-agent) только для Telegram
│  │  ├─ db/           # drizzle: schema + клиент + DAO-папки по таблицам (characters/ personas/
│  │  │                #   presets/ chats/ stories/ knowledge/ … — у каждой DAO + types/constants + barrel)
│  │  ├─ llm/          # клиент LLM (OpenRouter / DeepSeek, выбор через LLM_PROVIDER)
│  │  ├─ handlers/     # обработчики команд бота (/start …)
│  │  ├─ server/       # Hono HTTP API (/health, /api), доменные папки (зеркало webapp): routes —
│  │  │                #   карта эндпоинтов, у каждого домена *.controller.ts + validation/constants/
│  │  │                #   types; chats/ stories/ — SSE-генерация; prompt/ media/ shared/ + статика
│  │  ├─ scripts/      # разовые скрипты (backfill шифрования сообщений)
│  │  └─ utils/        # retry, crypto (per-user шифрование)
│  └─ drizzle/         # SQL-миграции
└─ webapp/             # Mini App (React + Vite)
   └─ src/
      ├─ main.tsx      # точка входа + init Telegram SDK
      ├─ init.ts       # инициализация SDK + restore initData
      ├─ app/          # оболочка: App (AppRoot + HashRouter), routes, BackButton-мост
      ├─ pages/        # экраны-маршруты (home/ characters/ personas/ generation-presets/ rp-chat/
      │                #   narrator/ knowledge-books/ narrator-templates/ debug/)
      ├─ shared/       # api/client (граница к /api), telegram/, text/, image/, components/
      └─ features/     # доменные модули: characters, personas, generation-presets, rp-chat,
                        #   narrator, knowledge-books, narrator-templates, debug
```

## Прокси для Telegram

Запросы **только к Telegram Bot API** проходят через локальный HTTP-прокси (`TELEGRAM_PROXY_URL`,
например `http://127.0.0.1:8080`, без авторизации). Реализовано через `https-proxy-agent`
(`HttpsProxyAgent`, CONNECT-туннелирование), который подключается исключительно к grammY-клиенту —
OpenRouter и любые другие запросы идут напрямую.

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
yarn test                                   # юнит-тесты bot + webapp (vitest)
yarn workspace bot drizzle-kit generate     # сгенерировать миграцию из изменений схемы
yarn workspace bot drizzle-kit migrate      # применить миграции
```

## Переменные окружения

См. [`bot/.env.example`](bot/.env.example). Обязательные: `BOT_TOKEN`, `DATABASE_URL`.

**LLM-провайдер** выбирается переменной `LLM_PROVIDER` (`openrouter` | `deepseek`, по умолчанию
`openrouter`). Для OpenRouter — `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`; для DeepSeek —
`DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` (дефолт `deepseek-v4-flash`). Чтобы слать все запросы в
DeepSeek, поставь `LLM_PROVIDER=deepseek` и задай `DEEPSEEK_API_KEY`.

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
