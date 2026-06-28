import type { MessageInPath } from "../../db/chats/index.js";
import type { GenerationPreset } from "../../db/schema.js";
import type { TrimInfo } from "./budget.js";

export type PromptCharacter = {
  name: string;
  prompt: string;
  scenario: string;
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

export type ImpersonateOptions = {
  /** Шаблон из пресета (preset.userPersonaPrompt). Пустой → DEFAULT_IMPERSONATE_TEMPLATE. */
  template: string;
  character: PromptCharacter;
  persona: PromptPersona | null;
  systemPrompt: string;
  auxPrompt: string;
  history: MessageInPath[];
  // Лимиты контекста из пресета — для обрезки истории (как в buildMessages). Не заданы → без обрезки.
  contextUnlimited?: boolean;
  contextSize?: number | null;
  maxTokens?: number | null;
  /** Хук на факт обрезки истории (для логирования на стороне вызова). */
  onTrim?: (info: TrimInfo) => void;
};

/** Управление сборкой запроса: отключение обрезки (для статистики) и хук на факт обрезки истории. */
export type BuildMessagesControl = {
  /** false — НЕ урезать историю под contextSize (нужно статистике: показать «желаемый» объём). */
  trim?: boolean;
  /** Вызывается, если из истории что-то отброшено по бюджету (для логирования на стороне вызова). */
  onTrim?: (info: TrimInfo) => void;
};
