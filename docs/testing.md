# Тесты — vitest в обоих пакетах

Короткие правила — в CLAUDE.md → «Testing». Здесь — подробности и «почему так».

## Устройство
- **vitest** в **обоих** workspace (`bot/` и `webapp/`), у каждого свой `vitest.config.ts` (pool `forks`).
  Корневой `yarn test` сначала собирает `shared/`, потом гоняет оба пакета по очереди; `yarn test:watch` — только bot.
- Один файл: `cd bot && yarn vitest run src/path/file.test.ts` (webapp — `cd webapp`). Пакеты читают
  `@tg-rp-bot/shared` из собранного `shared/dist` — на свежем клоне сначала `yarn build:shared`.
- Тесты лежат рядом с кодом: `transform.ts` → `transform.test.ts`, раннер ищет `src/**/*.test.ts`.
- В `bot/` `tsc` (`yarn build`) исключает тесты через `**/*.test.ts` в `tsconfig.json` — в `dist/` они
  не попадают. В `webapp/` сборка `noEmit` (vite бандлит только импортируемое), исключать не нужно.

## Что тестируем
Чистые функции — трансформеры, форматтеры, парсеры, retry/decision-логика: всё без I/O.
Воркеры, репозитории (drizzle) и Telegram/LLM-хендлеры **не** юнит-тестируем (нужны живая БД, внешние
сервисы, изменяемое состояние модуля). Добавил новую чистую логику — положи `*.test.ts` рядом.

## Импорты
- **bot:** в тестах тоже `.js` у относительных импортов (native ESM). Vitest/Vite сам резолвит `.js` → `.ts`.
- **webapp:** импорты **без** `.js` (bundler resolution). Чистую логику изолируем от Telegram SDK —
  напр. SSE-парсер `parseSSE.ts` вынесен из `sse.ts`, чтобы тест не тянул `@telegram-apps/sdk-react`.

## Не тянуть `config`/`logger` транзитивно
Модуль, импортирующий `../logger.js`, потянет `config.ts` (он `requireEnv`-ит `BOT_TOKEN` и т.д. и упадёт
без `.env`) плюс воркер-потоки pino-roll. Мокать:

```ts
vi.mock("../logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
```

## Pool `forks` — намеренно
На Windows пул `threads` + холодный dep-optimizer Vite иногда валит первый прогон. `forks` делает
холодные прогоны детерминированными — не менять на `threads`. Если всё же увидел холодный флейк
(`Cannot read properties of undefined (reading 'config')`, 0 passed) — просто перезапусти `yarn test`.

## `vite` — явная devDependency
В `src/` никто не импортирует `vite`, но в **vitest 4 Vite — `peerDependency`**, поэтому он обязан быть
установлен проектом, а не жить транзитивным остатком. Если он пропал/битый — весь suite падает на
**каждом** файле с `TypeError: Cannot read properties of undefined (reading 'config')`, и перезапуск
не помогает. Лечение — `yarn install`; явный пин не даёт проблеме вернуться. Мажор `vite` держим в
peer-диапазоне vitest (`^6 || ^7 || ^8`).
