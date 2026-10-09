# LLM-провайдер — DeepSeek, per-user BYOK

Короткие правила — в CLAUDE.md → «Critical invariants» и «External APIs». Здесь — устройство.

## Ключ и модель — у каждого пользователя свои
Глобального ключа/модели нет. Пользователь задаёт их в Mini App → `/settings` → «ИИ (DeepSeek)»:
- webapp: `webapp/src/features/llm-settings/`
- сервер: `bot/src/settings/llm/` (Nest: контроллер, сервис, репозиторий)
- хранение: `user_settings`, зашифровано (`llm-settings.repository.ts`, ключ шифрования — `ENCRYPTION_KEY`).

Ключ в браузер не отдаётся; RP-генерация идёт через HTTP API бота, а не напрямую из webapp.
Tavily (веб-поиск) устроен так же: per-user ключ в `bot/src/settings/tavily/`, `features/tavily-settings/`.

## Резолв провайдера
За каждый запрос провайдер резолвится через `bot/src/llm/resolveProvider.ts` (`resolveProvider(userId)`).
Без сохранённого ключа бросается `MissingApiKeyError` (`bot/src/llm/errors.ts`) — **без фоллбэка** на
общий/env-ключ. `bot/src/llm/client.ts` — общий OpenAI-совместимый клиент.

## OpenRouter — запасной путь, не активен
Фабрика `buildOpenRouterProvider()` (`providers.ts`) оставлена заделом и нигде не вызывается — пути
конфигурации OpenRouter сейчас нет.

**Инвариант:** тело запросов OpenRouter не меняем. Reasoning («мышление» из пресета, поля
`requestReasoning`/`reasoningEffort`) применяется только для DeepSeek (`thinking`-режим); для OpenRouter
`reasoningBody` возвращает `{}`.
