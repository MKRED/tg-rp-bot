import type { ChatCompletionOptions, ChatCompletionResult, OnToolCallDelta } from "../types.js";

/**
 * Типы DeepSeek Responses API (`POST /v1/responses`). Только то, что нам нужно, и только в той форме,
 * которую DeepSeek принимает (проверено пробами на живом API, 2026-11):
 * - картинка — `input_image` с image_url СТРОКОЙ (http(s) или data URL); объект `{ url }` даёт 400;
 * - картинки разрешены в user-сообщениях и в выводе инструмента (function_call_output), в system и
 *   assistant — 400. Это и есть причина перехода: Chat Completions пускает картинки только в user.
 */

/** Часть составного содержимого: текст или картинка. */
export type ResponsesContentPart = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };

/** Элемент `input`: сообщение по роли или элемент протокола (рассуждение, вызов инструмента, его результат). */
export type ResponsesInputItem =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ResponsesContentPart[] }
  | { role: "assistant"; content: string }
  /**
   * Рассуждение модели перед вызовами инструментов. DeepSeek его обратно НЕ требует (в отличие от
   * reasoning_content в Chat Completions), но принимает — внутри хода возвращаем живое, чтобы модель
   * не теряла ход мысли между раундами.
   */
  | { type: "reasoning"; summary: []; content: Array<{ type: "reasoning_text"; text: string }> }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  /** Результат вызова; парный function_call обязан стоять раньше, иначе 400 "No tool output found". */
  | { type: "function_call_output"; call_id: string; output: string | ResponsesContentPart[] };

/**
 * Параметры запроса. Сэмплинг, reasoning, tools (в chat-формате, переводятся в request.ts) — те же,
 * что у Chat Completions: пресет и описания инструментов общие для обоих протоколов.
 */
export interface ResponsesRequestOptions extends Omit<ChatCompletionOptions, "messages"> {
  input: ResponsesInputItem[];
}

/** Элемент `output` ответа — только читаемые нами поля. */
export interface RawOutputItem {
  type: string;
  status?: string;
  /** message: output_text; reasoning: reasoning_text. */
  content?: Array<{ type: string; text?: string }>;
  call_id?: string;
  name?: string;
  arguments?: string;
}

/** Объект ответа (non-stream тело и `response` в финальном событии стрима). */
export interface RawResponse {
  model: string;
  status: string;
  output: RawOutputItem[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  };
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string; code?: string } | null;
}

/** Результат: тот же, что у Chat Completions, плюс причина обрыва. */
export interface ResponsesResult extends ChatCompletionResult {
  /** status "incomplete" (обычно max_output_tokens — в него входит и reasoning): ответ обрезан. */
  incompleteReason?: string;
}

/**
 * Кто умеет выполнить запрос Responses API для пользователя — LlmService (ключ из его настроек).
 * Отдельный от ChatCompleter интерфейс: на Responses переведён только соавтор, остальные пути
 * остаются на Chat Completions.
 */
export interface ResponsesCompleter {
  respond(
    options: ResponsesRequestOptions,
    onChunk?: (token: string) => void,
    onReset?: () => void,
    onToolCall?: OnToolCallDelta,
  ): Promise<ResponsesResult>;
}
