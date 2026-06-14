/**
 * Дефолтный шаблон системной инструкции для генерации реплики от лица пользователя.
 * Показывается серым placeholder'ом в поле «Промпт для генерации ответа от лица пользователя»,
 * когда оно пустое — и именно он применяется на сервере при пустом поле.
 *
 * ВАЖНО: держать в синхроне с bot/src/server/promptBuilder.ts (DEFAULT_IMPERSONATE_TEMPLATE).
 */
export const DEFAULT_IMPERSONATE_TEMPLATE = `Write your next reply from the point of view of {{user}}, using the chat history as a guideline for {{user}}'s writing style. Write 1 reply only. Don't write as {{char}}. Don't describe actions of {{char}}.

About {{char}}:
{{char_prompt}}

About {{user}}:
{{user_prompt}}`;
