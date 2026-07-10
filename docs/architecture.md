# Архитектура — карта модулей и границы

Полный инвентарь дерева проекта и детали двух «граблевых» границ (прокси Telegram,
Mini App API). CLAUDE.md держит только верхнеуровневую карту + правила-раскладки;
здесь — подробности.

> ⚠️ Дерево ниже отражает текущее состояние. Что убрали из кода — убираем и отсюда.

---

## Дерево `bot/`

```
bot/src/
  index.ts      — entry point (thin: register handlers + start server + start bot)
  bot.ts        — grammY bot instance (+ прокси для Telegram через baseFetchConfig)
  bot.constants.ts
  config.ts     — env vars (requireEnv для обязательных, process.env для опциональных)
  logger.ts     — pino logger (daily rolling, pino-pretty in TTY)
  proxy.ts      — HttpsProxyAgent (https-proxy-agent) ТОЛЬКО для Telegram
  db/           — drizzle: schema.ts (+ schema.types.ts — id-типы/порядок промптов) + клиент +
                  DAO-папки по таблицам: characters/ personas/ presets/ impersonations/
                  narratorTemplates/ (у каждой DAO-файл + types.ts/constants.ts + barrel index.ts),
                  chats/ stories/ knowledge/ (деревья/лорбук), users.ts, userSettings.ts
  llm/          — LLM client (client/request/errors/types/constants/completionGuard/providers) —
                  серверно, провайдер (OpenRouter | DeepSeek) выбирается env LLM_PROVIDER;
                  debugCapture (+debug.types) — in-memory перехват RAW-запросов к LLM для экрана отладки
  handlers/     — обработчики команд/кнопок бота (index = registerHandlers, start.ts,
                  photoActions.ts — callback «Закрыть» под фото из лайтбокса)
  server/       — Hono HTTP API, разложен по доменным папкам (зеркало webapp): index=startServer,
                  routes.ts — карта эндпоинтов (монтаж контроллеров), middleware/ (initData — валидация
                  подписи), доменные папки me/ characters/ personas/ presets/ books/ narrator-templates/
                  chats/ stories/ debug/ — у каждого <домен>.controller.ts (Hono-роуты) + validation/
                  constants/types рядом + barrel index.ts; chats/ — messages.handlers + impersonate.handlers
                  + stats.handler; stories/ — story.handlers (SSE-генерация RP/narrator); prompt/ —
                  promptBuilder + storyPromptBuilder + общий budget (у каждого constants/types/test рядом);
                  media/ — profilePhoto + photoToChat (POST /me/send-photo); shared/ — fkViolation,
                  imageValidation, streamGeneration, translate (переиспользуемое между доменами)
                  + раздача собранной статики Mini App из ./public (SPA-fallback) — один процесс
  scripts/      — разовые скрипты (backfill-message-encryption)
  utils/        — retry, crypto (per-user шифрование сообщений)
```

## Дерево `webapp/`

```
webapp/src/
  main.tsx      — точка входа: initTelegram() + рендер <App/>
  init.ts       — инициализация @telegram-apps SDK (защищённая) + initData.restore()
  app/          — оболочка: App.tsx (AppRoot + HashRouter), routes.ts, BackButtonBridge, deepLink.ts
  pages/        — экраны-маршруты (один на маршрут): home/ characters/ personas/
                  generation-presets/ rp-chat/ narrator/ knowledge-books/ narrator-templates/ debug/
  features/     — доменные модули (по подпапкам-категориям + barrel index.ts):
                  characters/ personas/ generation-presets/ rp-chat/ narrator/ knowledge-books/
                  narrator-templates/ debug/
  shared/       — кросс-каттинг: api/ (client с Authorization), telegram/ (initData, confirm, profile
                  photo, platform), text/, image/, graph/, hooks/, constants/, toast/, components/
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

---

## Прокси для Telegram — детали

Правило (в CLAUDE.md): прокси `TELEGRAM_PROXY_URL` цепляется **только** к grammY-клиенту,
глобальный прокси запрещён. Почему именно `agent`, а не `dispatcher`:

⚠️ grammY в Node использует **node-fetch@2** (не нативный fetch!), который проксируется через
option `agent`. undici `dispatcher` он **игнорирует** — хотя тип `baseFetchConfig` выведен из
нативного fetch и обманчиво подсказывает `dispatcher`. Проверено рантайм-тестом: с `agent` getMe
доходит до Telegram, с `dispatcher` — уходит напрямую в обход прокси. Отсюда каст в `bot.ts`
(`proxy.ts` → `HttpsProxyAgent` → `client.baseFetchConfig.agent`).

Глобальный прокси (`HTTPS_PROXY` / `ALL_PROXY`) увёл бы через прокси и трафик к OpenRouter — нельзя.

---

## Mini App API — детали границы

Правило (в CLAUDE.md): ключ OpenRouter только серверно; webapp ходит в `/api/*` с подписанным
`initData`. Детали валидации:

Запросы webapp → `/api/*` несут подписанный Telegram `initData` в заголовке
`Authorization: tma <initData>` (webapp: `shared/api/client.ts`). Сервер
(`server/middleware/initData.ts`) **проверяет HMAC-подпись** по `BOT_TOKEN` через
**`@tma.js/init-data-node`** (`validate` бросает при подделке/просрочке, `parse` достаёт юзера в
`c.get("tgUser")`). Без подписи: в проде → 401, в dev → пропускаем (отладка webapp из браузера).

⚠️ Серверный пакет — **`@tma.js/init-data-node`**, НЕ `@telegram-apps/init-data-node` (последний
deprecated). Это противоположно выбору org для **webapp** (там `@telegram-apps/*` — см. README/стек):
не «чинить» ради единообразия. По умолчанию `validate` считает initData просроченным через сутки
(`expiresIn` = 86400) — учесть для долгих сессий webview (дадут 401).
