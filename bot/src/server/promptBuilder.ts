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
