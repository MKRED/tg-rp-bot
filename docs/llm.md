# LLM-провайдер — DeepSeek, per-user BYOK

Короткие правила — в CLAUDE.md → «Critical invariants» и «External APIs». Здесь — устройство.

## Ключ — у каждого пользователя свой, модель — у каждого пресета своя
Глобального ключа нет. Пользователь задаёт ключ в Mini App → `/settings` → «ИИ (DeepSeek)»:
- webapp: `webapp/src/features/llm-settings/`
- сервер: `bot/src/settings/llm/` (Nest: контроллер, сервис, репозиторий)
- хранение: `user_settings`, зашифровано (`llm-settings.repository.ts`, ключом пользователя `users.data_key` — [architecture.md](architecture.md#шифрование-данных-пользователя)).

Модель выбирается в пресете генерации (`generation_presets.model`, карточка «Ответ модели» в
`features/generation-presets/`; список моделей — тот же `POST /settings/llm/verify`, что проверяет ключ).
`model: null` — `DEFAULT_DEEPSEEK_MODEL` (`@tg-rp-bot/shared`); на ней же идут вызовы без пресета
(перевод произвольного текста).

Ключ в браузер не отдаётся; RP-генерация идёт через HTTP API бота, а не напрямую из webapp.
Tavily (веб-поиск) устроен так же: per-user ключ в `bot/src/settings/tavily/`, `features/tavily-settings/`.

## Резолв провайдера
Вызов LLM — `LlmService.complete()` (`bot/src/llm/llm.service.ts`, модуль `LlmModule`): на **каждый**
запрос читает ключ пользователя из `LlmSettingsRepository` и передаёт провайдера чистому клиенту
`requestChatCompletion()` (`bot/src/llm/client.ts`, общий OpenAI-совместимый: стриминг, ретраи, перехват
для экрана отладки). Модель приходит в `options.model` из пресета (`presetToCompletionOptions`, перевод в
чате/истории и сжатие берут модель пресета чата/истории). Без сохранённого ключа бросается `MissingApiKeyError` (`bot/src/llm/errors.ts`) —
**без фоллбэка** на общий/env-ключ. Nest-сервисы инжектят `LlmService`; чистые функции (`streamCompletion`,
`aiTranslate`, цикл инструментов карточек) получают его параметром как `ChatCompleter`.

## Reasoning (thinking-режим DeepSeek)
DeepSeek — единственный поддерживаемый провайдер, других путей нет. «Мышление» из пресета (поля
`requestReasoning`/`reasoningEffort`) превращается в `thinking`-поля тела запроса
(`deepSeekReasoningBody`, `providers.ts`). Уровни — ровно DeepSeek-овские `low|high|max`
(`REASONING_EFFORTS`); `mapEffort` лишь страхует от неизвестной строки (→ `high`, иначе 422).

## Сэмплинг
В пресете только `temperature` и `topP` — остальное (top_k, penalties, min_p, top_a) DeepSeek не
поддерживает или игнорирует. Где что действует (docs: create-chat-completion, guides/thinking_mode):
температура — только без рассуждения; Top P у `deepseek-flash` — только с рассуждением и не ниже 0.95,
у `deepseek-v4-pro` — только без него. Форма пресета показывает лишь действующие параметры
(`lib/model-rules.ts`); в запрос значения уходят как сохранены — DeepSeek сам игнорирует лишнее.

**Принудительный вызов инструмента:** DeepSeek в `thinking`-режиме отклоняет именованный `tool_choice`
(400 «Thinking mode does not support this tool_choice»). Поэтому кнопка «с вопросами» в генерации
карточек (`forceAskUser`, `cards/generation/tool-loop.ts`) шлёт принудительный ход с выключенным
reasoning; остальные ходы идут с `tool_choice: "auto"` и reasoning из пресета. Когда принуждать — настройка
карточки `askUserFirst`: первым ходом либо в конце, когда модель закончила с остальными инструментами
(её черновой ответ отбрасывается; если она сама вызвала `ask_user`, принуждения нет).

## Картинки (vision)

Картинки видит только `deepseek-flash` (`DEEPSEEK_VISION_MODELS` / `modelSupportsImages` в
`@tg-rp-bot/shared`): формат OpenAI — `content: [{type:"text"}, {type:"image_url", image_url:{url}}]`,
только в user-сообщениях (тип `MultimodalUserMessage` в `llm/types.ts`), JPEG/PNG/GIF/WebP, data URL или
https. Проверено запросами: `deepseek-v4-pro` отвечает 200, но молча заменяет картинку на
«[Unsupported Image]» — HTTP-ошибки нет, поэтому модель проверяется заранее (генерация карточки с
референсами при такой модели — 400 `images_unsupported`). Цена картинки растёт с размером (~400 токенов
за 386×1051, ~900 за 1000×1333), поэтому webapp ужимает референсы до `REFERENCE_IMAGE_MAX_SIDE`.
На экран отладки data URL картинок не попадают — `llm/redact-images.ts` заменяет их описанием.

Сейчас картинки шлёт одна фича — референсы внешности карточки «Мастерской» (`cards.reference_images`, до
`MAX_CARD_REFERENCE_IMAGES`): прикрепляются к первому user-сообщению каждой генерации блока
(`cards/generation/prompt-assembly.ts`).
