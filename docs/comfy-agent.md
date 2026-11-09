# Агент ComfyUI

Подключение собственного ComfyUI пользователя (для генерации картинок). ComfyUI стоит на ПК
пользователя, ключа у него нет; сервер общается с ним только через агента — PowerShell-скрипт на этом ПК.
План генерации картинок и статус этапов — [plan/image-generation.md](plan/image-generation.md).

- Код: `bot/src/comfy-agent/` (API `/api/comfy-agent`), `webapp/src/features/comfy-agent/`
  (карточка «ComfyUI» в `pages/settings/SettingsPage.tsx`).
- Контракт: `shared/src/comfy-agent.ts`.
- Скрипты агента: `bot/assets/comfy-agent/` (`comfy-agent.ps1`, `install.ps1`, UTF-8 с BOM).
  Dockerfile копирует `bot/assets`; сервер читает их из `src/` и `dist/` по пути относительно модуля
  (`install/agent-scripts.ts`).

## Почему агент

Страница открыта по HTTPS, а ComfyUI отвечает по HTTP — браузер не может ходить в него напрямую
(Mixed Content). Поэтому агент сам держит исходящий HTTPS long-poll к серверу. Прокси агенту не нужен
(инвариант про прокси из CLAUDE.md его не касается: идёт прямое соединение).

## Поток

- `GET /api/comfy-agent/agent/poll` — long-poll (удержание ~20 с), отдаёт задания.
- `POST /api/comfy-agent/agent/result/:id` — агент возвращает результат.
- Очередь заданий живёт в памяти процесса (`relay/relay-hub.ts`, `RelayHub`), не в БД.
- Агент шлёт версию в заголовке `X-Agent-Version` (сейчас 2; без заголовка — 1). Статус отдаёт `agentVersion` и
  `agentOutdated` (меньше `REQUIRED_COMFY_AGENT_VERSION`): карточка в Настройках просит установить заново.
  Ответ старого агента «blocked by agent allowlist» сервер превращает в 502 `comfy_agent_outdated`.
- Запросы к ComfyUI агент выполняет на `127.0.0.1` по белому списку (`comfy-paths.ts`); список проверяется
  и на сервере, и в агенте.
- `GET /api/comfy-agent/check` — готовность ComfyUI: версия, видеокарта, ноды и файлы моделей
  Qwen-Image 2.1 и Turbo. Требования — `readiness/requirements.ts`.

## Авторизация и установка

- Агентские маршруты (`agent/*`) помечены `@Public` и проверяют свой `Authorization: Bearer`-токен;
  `install` и `script` доступны без входа (их скачивает PowerShell).
- В БД хранится только SHA-256 токена: `user_settings.comfy_agent_token_hash` (миграция 0054).
- Карточка «ComfyUI» в Настройках выдаёт команду `irm '<сайт>/api/comfy-agent/agent/install?c=<код>' | iex`.
  Код одноразовый, живёт 15 минут, хранится в памяти (`install/install-codes.ts`). Токен выпускается в
  момент, когда сервер погашает код.
- Установщик кладёт агента и `config.json` в `%LOCALAPPDATA%\tg-rp-bot-agent`, создаёт ярлык на рабочем
  столе и запускает агента. ComfyUI агент ищет на `http://127.0.0.1:8188`; другой адрес — поле `comfy`
  в `config.json` или параметр `-Comfy`.
- «Отключить ПК» удаляет токен: агент получает 401 и останавливается. Повторная установка тоже выпускает
  новый токен, прежний агент отключается.
