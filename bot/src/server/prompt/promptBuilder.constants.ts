/**
 * Жёсткий потолок истории для impersonate — последние 30 сообщений (15 пар user/ИИ).
 * Для ответа от лица игрока хватает свежего контекста; дальше идёт уже обрезка под contextSize.
 */
export const IMPERSONATE_HISTORY_LIMIT = 30;

/**
 * Дефолтный шаблон системной инструкции для генерации реплики от лица пользователя.
 * Используется, когда поле userPersonaPrompt пустое. БЕЗ {{system_prompt}} — он обычно
 * «ты — {{char}}» и вернул бы character-ориентацию, от которой здесь как раз уходим.
 * ВАЖНО: держать в синхроне с webapp DEFAULT_IMPERSONATE_TEMPLATE
 * (webapp/src/features/generation-presets/lib/impersonateTemplate.ts).
 */
export const DEFAULT_IMPERSONATE_TEMPLATE = `Write your next reply from the point of view of {{user}}, using the chat history as a guideline for {{user}}'s writing style. Write 1 reply only. Don't write as {{char}}. Don't describe actions of {{char}}.

About {{char}}:
{{char_prompt}}

About {{user}}:
{{user_prompt}}`;
