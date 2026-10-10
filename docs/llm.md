# LLM-провайдер — DeepSeek, per-user BYOK

Короткие правила — в CLAUDE.md → «Critical invariants» и «External APIs». Здесь — устройство.

## Ключ и модель — у каждого пользователя свои
Глобального ключа/модели нет. Пользователь задаёт их в Mini App → `/settings` → «ИИ (DeepSeek)»:
- webapp: `webapp/src/features/llm-settings/`
- сервер: `bot/src/settings/llm/` (Nest: контроллер, сервис, репозиторий)
- хранение: `user_settings`, зашифровано (`llm-settings.repository.ts`, ключом пользователя `users.data_key` — [architecture.md](architecture.md#шифрование-данных-пользователя)).

Ключ в браузер не отдаётся; RP-генерация идёт через HTTP API бота, а не напрямую из webapp.
Tavily (веб-поиск) устроен так же: per-user ключ в `bot/src/settings/tavily/`, `features/tavily-settings/`.

## Резолв провайдера
Вызов LLM — `LlmService.complete()` (`bot/src/llm/llm.service.ts`, модуль `LlmModule`): на **каждый**
запрос читает ключ/модель пользователя из `LlmSettingsRepository` (модель не выбрана —
`DEFAULT_DEEPSEEK_MODEL`, `llm/constants.ts`) и передаёт провайдера чистому клиенту
`requestChatCompletion()` (`bot/src/llm/client.ts`, общий OpenAI-совместимый: стриминг, ретраи, перехват
для экрана отладки). Без сохранённого ключа бросается `MissingApiKeyError` (`bot/src/llm/errors.ts`) —
**без фоллбэка** на общий/env-ключ. Nest-сервисы инжектят `LlmService`; чистые функции (`streamCompletion`,
`aiTranslate`, цикл инструментов карточек) получают его параметром как `ChatCompleter`.

## OpenRouter — запасной путь, не активен
Фабрика `buildOpenRouterProvider()` (`providers.ts`) оставлена заделом и нигде не вызывается — пути
конфигурации OpenRouter сейчас нет.

**Инвариант:** тело запросов OpenRouter не меняем. Reasoning («мышление» из пресета, поля
`requestReasoning`/`reasoningEffort`) применяется только для DeepSeek (`thinking`-режим); для OpenRouter
`reasoningBody` возвращает `{}`.
