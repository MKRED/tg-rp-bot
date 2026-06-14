import type { MessageInPath } from "../db/chats.js";
import type { GenerationPreset } from "../db/schema.js";
import type { ChatMessage } from "../llm/types.js";

export type PromptCharacter = {
  name: string;
  prompt: string;
};

export type PromptPersona = {
  name: string;
  prompt: string;
};

export type BuildMessagesOptions = {
  preset: GenerationPreset;
  character: PromptCharacter;
  persona: PromptPersona | null;
  history: MessageInPath[];
  /** Новое сообщение пользователя, добавляемое в конец. */
  userMessage: string;
};

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

export type ImpersonateOptions = {
  /** Шаблон из пресета (preset.userPersonaPrompt). Пустой → DEFAULT_IMPERSONATE_TEMPLATE. */
  template: string;
  character: PromptCharacter;
  persona: PromptPersona | null;
  systemPrompt: string;
  auxPrompt: string;
  history: MessageInPath[];
};

/**
 * Заменяет плейсхолдеры {{char}} и {{user}} на имена персонажа и персоны.
 * Регистронезависимо: {{Char}}, {{CHAR}}, {{User}}, {{USER}} и т.д.
 * Если персона не задана — подставляется "User".
 */
export function replacePlaceholders(text: string, charName: string, userName: string): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName);
}

/**
 * Собирает массив ChatMessage[] для отправки в OpenRouter.
 * Порядок компонентов определяется preset.promptOrder; отключённые компоненты пропускаются.
 * Во всех текстах автоматически заменяются {{char}} и {{user}} на имена персонажа/персоны.
 *
 * Каждый компонент — один ChatMessage (или массив для history):
 *   system          → role:"system", preset.systemPrompt
 *   characterDescription → role:"system", character.prompt
 *   userDescription → role:"system", persona.prompt  (только если включён и persona != null)
 *   auxiliary       → role:"system", preset.auxiliarySystemPrompt
 *   history         → MessageInPath[] → {role, content}[]
 *   postHistory     → role:"user",   preset.postHistoryInstruction
 *
 * После всех компонентов добавляется новое сообщение пользователя.
 */
export function buildMessages(opts: BuildMessagesOptions): ChatMessage[] {
  const { preset, character, persona, history, userMessage } = opts;
  const charName = character.name;
  const userName = persona?.name ?? "User";
  const sub = (text: string) => replacePlaceholders(text, charName, userName);
  const result: ChatMessage[] = [];

  for (const item of preset.promptOrder) {
    if (!item.enabled) continue;

    switch (item.id) {
      case "system":
        if (preset.systemPrompt) {
          result.push({ role: "system", content: sub(preset.systemPrompt) });
        }
        break;

      case "characterDescription":
        if (character.prompt) {
          result.push({ role: "system", content: sub(character.prompt) });
        }
        break;

      case "userDescription":
        // Включён явно пользователем — показываем персону, если задана
        if (persona?.prompt) {
          result.push({ role: "system", content: sub(persona.prompt) });
        }
        break;

      case "auxiliary":
        if (preset.auxiliarySystemPrompt) {
          result.push({ role: "system", content: sub(preset.auxiliarySystemPrompt) });
        }
        break;

      case "history":
        for (const msg of history) {
          result.push({ role: msg.role, content: sub(msg.content) });
        }
        break;

      case "postHistory":
        if (preset.postHistoryInstruction) {
          result.push({ role: "user", content: sub(preset.postHistoryInstruction) });
        }
        break;
    }
  }

  result.push({ role: "user", content: sub(userMessage) });
  return result;
}

/**
 * Подставляет блочные плейсхолдеры (промпты) в шаблон impersonate, затем {{char}}/{{user}}.
 * Порядок важен: сперва вставляем тексты промптов, потом заменяем имена — чтобы {{char}}/{{user}}
 * внутри вставленных промптов тоже разрешились.
 */
function renderImpersonateTemplate(
  template: string,
  ctx: {
    charName: string;
    userName: string;
    charPrompt: string;
    userPrompt: string;
    systemPrompt: string;
    auxPrompt: string;
  },
): string {
  const withBlocks = template
    .replace(/\{\{char_prompt\}\}/gi, ctx.charPrompt)
    .replace(/\{\{user_prompt\}\}/gi, ctx.userPrompt)
    .replace(/\{\{system_prompt\}\}/gi, ctx.systemPrompt)
    .replace(/\{\{aux_prompt\}\}/gi, ctx.auxPrompt);
  return replacePlaceholders(withBlocks, ctx.charName, ctx.userName);
}

/**
 * Рендерит активный путь плоским текстом: «Имя:\n<реплика>», блоки через пустую строку.
 * Всегда заканчивается затравкой «<userName>:» — явный speaker cue для модели: история обычно
 * кончается репликой персонажа, и без затравки модель продолжила бы за {{char}} или эхнула бы
 * собственный префикс. Затравка снимает обе проблемы (ответ не в том лице / эхо префикса).
 */
function renderImpersonateHistory(
  history: MessageInPath[],
  charName: string,
  userName: string,
): string {
  const body = history
    .map((m) => {
      const name = m.role === "assistant" ? charName : userName;
      return `${name}:\n${replacePlaceholders(m.content, charName, userName)}`;
    })
    .join("\n\n");
  return body ? `${body}\n\n${userName}:` : `${userName}:`;
}

/**
 * Собирает запрос impersonate — РОВНО 2 сообщения:
 *   system — шаблон с подставленными плейсхолдерами (или дефолт),
 *   user   — плоская история активного пути (роли вынесены в текст, чтобы снять
 *            обуславливание «продолжай как {{char}}»).
 * Намеренно НЕ использует promptOrder/buildMessages.
 */
export function renderImpersonateMessages(opts: ImpersonateOptions): ChatMessage[] {
  const charName = opts.character.name;
  const userName = opts.persona?.name ?? "User";
  const template = opts.template.trim() || DEFAULT_IMPERSONATE_TEMPLATE;

  const system = renderImpersonateTemplate(template, {
    charName,
    userName,
    charPrompt: opts.character.prompt,
    userPrompt: opts.persona?.prompt ?? "",
    systemPrompt: opts.systemPrompt,
    auxPrompt: opts.auxPrompt,
  });
  const user = renderImpersonateHistory(opts.history, charName, userName);

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * Маппит поля пресета в ChatCompletionOptions (сэмплинг-параметры).
 * null-значения пропускаются — OpenRouter применяет свои дефолты.
 */
export function presetToCompletionOptions(preset: GenerationPreset) {
  return {
    temperature: preset.temperature ?? undefined,
    maxTokens: preset.maxTokens ?? undefined,
    topP: preset.topP ?? undefined,
    topK: preset.topK ?? undefined,
    frequencyPenalty: preset.frequencyPenalty ?? undefined,
    presencePenalty: preset.presencePenalty ?? undefined,
    repetitionPenalty: preset.repetitionPenalty ?? undefined,
    minP: preset.minP ?? undefined,
    topA: preset.topA ?? undefined,
  };
}
