import type { MessageInPath } from "../../../db/chats/index.js";
import type { PromptOrderItem } from "../../../db/schema.js";
import type { TrimInfo } from "../budget.js";

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
  /** Промпты и порядок сборки — из RP-шаблона чата (rp_templates), режимо-специфичны. */
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  promptOrder: PromptOrderItem[];
  // Лимиты контекста — из пресета (сэмплинг, режимо-независим). Не заданы → без обрезки.
  contextUnlimited?: boolean;
  contextSize?: number | null;
  maxTokens?: number | null;
  character: PromptCharacter;
  persona: PromptPersona | null;
  history: MessageInPath[];
  /** Новое сообщение пользователя, добавляемое в конец. */
  userMessage: string;
};

export type ImpersonateOptions = {
  /** Шаблон impersonate — из RP-шаблона (rpTemplate.userPersonaPrompt). Пустой → DEFAULT_IMPERSONATE_TEMPLATE. */
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
