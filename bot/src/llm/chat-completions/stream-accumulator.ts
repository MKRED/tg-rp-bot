import type { ToolCall } from "../types.js";
import type { LlmStreamToolCallDelta } from "./types.js";

/** Вызов инструмента, собранный из дельт на текущий момент: аргументы могут быть ещё неполными. */
export interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Собирает tool_calls из дельт стрима. Формат OpenAI-совместимый: id и имя приходят в первой дельте
 * вызова, дальше по кускам — только arguments; вызовы различаются по index, а не по id.
 */
export class ToolCallAccumulator {
  private readonly calls = new Map<number, PartialToolCall>();

  /** Возвращает вызов в текущем состоянии; undefined — id или имя ещё не пришли, показывать нечего. */
  add(delta: LlmStreamToolCallDelta): PartialToolCall | undefined {
    const call = this.calls.get(delta.index) ?? { id: "", name: "", arguments: "" };
    if (delta.id) call.id = delta.id;
    if (delta.function?.name) call.name = delta.function.name;
    if (delta.function?.arguments) call.arguments += delta.function.arguments;
    this.calls.set(delta.index, call);
    return call.id && call.name ? call : undefined;
  }

  /** Готовые вызовы в порядке index; undefined — модель инструментов не вызывала. */
  result(): ToolCall[] | undefined {
    if (this.calls.size === 0) return undefined;
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.arguments } }));
  }
}
