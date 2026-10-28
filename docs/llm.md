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

## Reasoning (thinking-режим DeepSeek)
DeepSeek — единственный поддерживаемый провайдер, других путей нет. «Мышление» из пресета (поля
`requestReasoning`/`reasoningEffort`) превращается в `thinking`-поля тела запроса
(`deepSeekReasoningBody`, `providers.ts`; уровень схлопывает `mapEffort`).

**Принудительный вызов инструмента:** DeepSeek в `thinking`-режиме отклоняет именованный `tool_choice`
(400 «Thinking mode does not support this tool_choice»). Поэтому кнопка «с вопросами» в генерации
карточек (`forceAskUser`, `cards/generation/tool-loop.ts`) шлёт принудительный ход с выключенным
reasoning; остальные ходы идут с `tool_choice: "auto"` и reasoning из пресета. Когда принуждать — настройка
карточки `askUserFirst`: первым ходом либо в конце, когда модель закончила с остальными инструментами
(её черновой ответ отбрасывается; если она сама вызвала `ask_user`, принуждения нет).
