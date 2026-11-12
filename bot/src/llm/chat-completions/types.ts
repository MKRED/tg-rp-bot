import type { ToolCall } from "../types.js";

/** Сырые форматы Chat Completions (ответ и дельты стрима) — нужны только клиенту этого протокола. */

/** Сырой ответ LLM (OpenAI-совместимый, только нужные нам поля). */
export interface LlmResponse {
  model: string;
  choices: Array<{
    message: { role: string; content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Кусок вызова инструмента в дельте стрима: id и имя — в первом куске, дальше только arguments. */
export interface LlmStreamToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

/** Одна SSE-дельта при стриминге (choices[0].delta). */
export interface LlmStreamDelta {
  model?: string;
  choices: Array<{
    delta: { content?: string; role?: string; reasoning_content?: string | null; tool_calls?: LlmStreamToolCallDelta[] };
    finish_reason?: string | null;
  }>;
}
