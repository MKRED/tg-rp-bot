import { ResponseFailedError } from "../errors.js";
import type { OnToolCallDelta } from "../types.js";
import type { RawResponse } from "./types.js";

/** Событие стрима Responses: тип лежит в самом JSON (`type`), строка `event:` дублирует его — её не читаем. */
interface StreamEvent {
  type: string;
  output_index?: number;
  delta?: string;
  item?: { type?: string; call_id?: string; name?: string; arguments?: string; input?: string };
  response?: RawResponse;
  message?: string;
  code?: string;
}

/**
 * JSON из строки SSE `data:` (пробел после двоеточия необязателен). Не data-строка, `[DONE]` (у Responses
 * его нет, но терпим) или битый JSON — undefined: такие строки пропускаем, как и в Chat Completions.
 */
export function parseSseData(line: string): StreamEvent | undefined {
  if (!line.startsWith("data:")) return undefined;
  const raw = line.slice(5).trim();
  if (!raw || raw === "[DONE]") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && typeof (parsed as StreamEvent).type === "string"
      ? (parsed as StreamEvent)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Разбор событий стрима Responses. Дельты нужны только для живого показа (текст и вызовы по ходу);
 * итог берётся из `response` финального события — тот же объект, что у non-stream ответа, поэтому
 * накопленное по дельтам не может разойтись с результатом.
 *
 * Вызовы различаются по output_index: `output_item.added` приносит call_id и имя, дельты аргументов
 * (у custom-инструмента — дельты ввода, `custom_tool_call_input.delta`) ссылаются на тот же индекс.
 */
export class ResponsesStreamParser {
  private readonly calls = new Map<number, { id: string; name: string; arguments: string }>();
  private finalResponse: RawResponse | undefined;

  constructor(
    private readonly providerName: string,
    private readonly onText: (text: string) => void,
    private readonly onToolCall: OnToolCallDelta,
  ) {}

  /** Обрабатывает одно событие. Провал генерации (`response.failed`, `error`) — ResponseFailedError. */
  push(event: StreamEvent): void {
    switch (event.type) {
      case "response.output_text.delta":
        if (event.delta) this.onText(event.delta);
        return;
      case "response.output_item.added":
        if (
          (event.item?.type === "function_call" || event.item?.type === "custom_tool_call") &&
          event.output_index !== undefined && event.item.call_id && event.item.name
        ) {
          const call = { id: event.item.call_id, name: event.item.name, arguments: event.item.arguments ?? event.item.input ?? "" };
          this.calls.set(event.output_index, call);
          this.onToolCall({ ...call });
        }
        return;
      case "response.function_call_arguments.delta":
      case "response.custom_tool_call_input.delta": {
        const call = event.output_index !== undefined ? this.calls.get(event.output_index) : undefined;
        if (call && event.delta) {
          call.arguments += event.delta;
          this.onToolCall({ ...call });
        }
        return;
      }
      case "response.completed":
      case "response.incomplete":
        this.finalResponse = event.response;
        return;
      case "response.failed":
        throw new ResponseFailedError(
          this.providerName,
          event.response?.error?.message ?? event.response?.error?.code ?? "response.failed",
        );
      case "error":
        throw new ResponseFailedError(this.providerName, event.message ?? event.code ?? "error event");
    }
  }

  /** Финальный объект ответа. Стрим закрылся без него — обрыв, ретраибл. */
  result(): RawResponse {
    if (!this.finalResponse) throw new ResponseFailedError(this.providerName, "stream ended without a final response");
    return this.finalResponse;
  }
}
