import type { PromptOrderItem } from "../../../db/schema.js";

/**
 * Жёсткий потолок истории для impersonate — последние 30 сообщений (15 пар user/ИИ).
 * Для ответа от лица игрока хватает свежего контекста; дальше идёт уже обрезка под contextSize.
 */
export const IMPERSONATE_HISTORY_LIMIT = 30;

/**
 * Дефолтный порядок компонентов RP-запроса на случай отсутствия шаблона у чата (defensive
 * fallback — chats.templateId в схеме NOT NULL, в норме этот путь не должен встречаться).
 */
export const DEFAULT_RP_PROMPT_ORDER: PromptOrderItem[] = [
  { id: "system", enabled: false },
  { id: "characterDescription", enabled: true },
  { id: "userDescription", enabled: false },
  { id: "auxiliary", enabled: false },
  { id: "characterScenario", enabled: false },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: false },
];

/**
 * Дефолтный шаблон системной инструкции для генерации реплики от лица пользователя.
 * Используется, когда поле userPersonaPrompt пустое. БЕЗ {{system_prompt}} — он обычно
 * «ты — {{char}}» и вернул бы character-ориентацию, от которой здесь как раз уходим.
 * ВАЖНО: держать в синхроне с webapp DEFAULT_IMPERSONATE_TEMPLATE
 * (webapp/src/features/rp-templates/lib/impersonateTemplate.ts).
 */
export const DEFAULT_IMPERSONATE_TEMPLATE = `Write your next reply from the point of view of {{user}}, using the chat history as a guideline for {{user}}'s writing style. Write 1 reply only. Don't write as {{char}}. Don't describe actions of {{char}}.

About {{char}}:
{{char_prompt}}

About {{user}}:
{{user_prompt}}`;
