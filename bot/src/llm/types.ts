/** Роль в диалоге (OpenAI-совместимая). */
export type ChatRole = "system" | "user" | "assistant";

/** Одно сообщение в истории диалога. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Параметры запроса к OpenRouter chat completion. */
export interface ChatCompletionOptions {
  messages: ChatMessage[];
  /** Переопределить модель из конфига для конкретного вызова. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
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

/** Сырой ответ OpenRouter (только нужные нам поля). */
export interface OpenRouterResponse {
  model: string;
  choices: Array<{ message: { role: string; content: string } }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
