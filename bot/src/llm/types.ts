import type { LlmCallLabel } from "./debugCapture.js";

/** Роль в диалоге (OpenAI-совместимая). */
export type ChatRole = "system" | "user" | "assistant";

/** Одно сообщение в истории диалога. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Параметры запроса к LLM chat completion (OpenAI-совместимый формат). */
export interface ChatCompletionOptions {
  messages: ChatMessage[];
  /** Переопределить модель из конфига для конкретного вызова. */
  model?: string;
  // Базовые
  temperature?: number;
  maxTokens?: number;
  // Расширенные параметры сэмплинга
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  minP?: number;
  topA?: number;
  // Reasoning («мышление»). Применяется провайдеро-специфично (для DeepSeek — thinking-режим).
  requestReasoning?: boolean;
  reasoningEffort?: string | null;

  /**
   * Чей это вызов. Обязателен: определяет персонального провайдера (resolveProvider, BYOK) —
   * без него chatCompletion не может выбрать ключ. Также используется debugCapture для фильтра
   * «только мои запросы» на экране отладки (buildBody выбирает поля явно, поэтому это поле
   * в тело запроса к LLM не попадает).
   */
  userId: number;
  /** Ярлык типа вызова (rp/impersonate/narrator/translate) — для списка на экране отладки. */
  debugLabel?: LlmCallLabel;
}

/** Упрощённый результат: текст ответа + расход токенов (для логов/биллинга). */
export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Сырой ответ LLM (OpenAI-совместимый, только нужные нам поля). */
export interface LlmResponse {
  model: string;
  choices: Array<{ message: { role: string; content: string } }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Одна SSE-дельта при стриминге (choices[0].delta). */
export interface LlmStreamDelta {
  model?: string;
  choices: Array<{
    delta: { content?: string; role?: string };
    finish_reason?: string | null;
  }>;
}
