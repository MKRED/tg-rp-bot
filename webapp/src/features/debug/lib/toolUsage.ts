import type { LlmDebugRecord } from "../types/debug";

/**
 * Какие инструменты участвуют в одной записи перехвата. Три разных факта, которые нельзя смешивать:
 * - offered — инструмент был ПРЕДЛОЖЕН модели (request.tools); tool-loop карточек кладёт его, пока не
 *   исчерпан бюджет, даже если модель в итоге ничего не позвала;
 * - called — модель запросила инструмент в ЭТОМ раунде (response.toolCalls);
 * - resultsInHistory — в истории запроса уже лежит результат инструмента (role: "tool"): либо из
 *   более раннего раунда цикла, либо синтетический реплей сохранённого контекста блока
 *   (ответы ask_user, результаты web_search — см. bot cards/generation/tool-context.ts).
 */
export interface ToolUsage {
  offered: string[];
  called: string[];
  resultsInHistory: string[];
}

type RawToolCall = { id?: unknown; function?: { name?: unknown } };
type RawMessage = { role?: unknown; tool_calls?: unknown; tool_call_id?: unknown };

const WEB_SEARCH = "web_search";

/** Человекочитаемые подписи известных инструментов; неизвестное имя показываем как есть. */
const TOOL_LABELS: Record<string, string> = {
  [WEB_SEARCH]: "веб-поиск",
  ask_user: "вопрос пользователю",
};

export const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

function unique(names: string[]): string[] {
  return [...new Set(names)];
}

function functionName(raw: unknown): string | undefined {
  const name = (raw as RawToolCall | null)?.function?.name;
  return typeof name === "string" && name ? name : undefined;
}

function names(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map(functionName).filter((n): n is string => n !== undefined);
}

/**
 * Разбирает запись на предложенные/вызванные инструменты и результаты в истории. Имя инструмента у
 * результата (role: "tool") в самом сообщении не лежит — только tool_call_id, поэтому сопоставляем
 * его с tool_calls предыдущих assistant-сообщений: без этого реплей ask_user считался бы поиском.
 */
export function describeToolUsage(record: Pick<LlmDebugRecord, "request" | "response">): ToolUsage {
  const messages = Array.isArray(record.request.messages) ? (record.request.messages as RawMessage[]) : [];

  const nameByCallId = new Map<string, string>();
  const resultsInHistory: string[] = [];
  for (const message of messages) {
    if (message?.role === "assistant" && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls as RawToolCall[]) {
        const name = functionName(call);
        if (typeof call?.id === "string" && name) nameByCallId.set(call.id, name);
      }
    }
    if (message?.role === "tool" && typeof message.tool_call_id === "string") {
      const name = nameByCallId.get(message.tool_call_id);
      if (name) resultsInHistory.push(name);
    }
  }

  return {
    offered: unique(names(record.request.tools)),
    called: unique(names(record.response.toolCalls)),
    resultsInHistory: unique(resultsInHistory),
  };
}

/**
 * Короткая пометка для шапки записи: что модель вызвала в этом раунде и опирался ли запрос на
 * результаты поиска. Реплей ask_user в шапку не выносим — это не событие раунда, а постоянный фон
 * всех запросов блока после ответа. undefined — помечать нечего.
 */
export function toolUsageSummary(usage: ToolUsage): string | undefined {
  const parts: string[] = [];
  if (usage.called.length > 0) parts.push(`вызов: ${usage.called.map(toolLabel).join(", ")}`);
  if (usage.resultsInHistory.includes(WEB_SEARCH)) parts.push("с результатами поиска");
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Строка для развёрнутой записи: предложенные и вызванные инструменты. undefined — инструментов не было. */
export function toolUsageDetails(usage: ToolUsage): string | undefined {
  if (usage.offered.length === 0 && usage.called.length === 0) return undefined;
  const list = (items: string[]) => (items.length > 0 ? items.join(", ") : "нет");
  return `Инструменты: предложены — ${list(usage.offered)}; вызваны — ${list(usage.called)}`;
}
