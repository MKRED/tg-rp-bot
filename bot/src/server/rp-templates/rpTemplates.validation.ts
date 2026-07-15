import type { RpTemplateInput } from "../../db/rpTemplates/index.js";
import type { PromptComponentId, PromptOrderItem } from "../../db/schema.js";
import { PROMPT_COMPONENT_IDS } from "./rpTemplates.constants.js";

/** promptOrder: массив ровно из известных компонентов (по разу) с boolean-флагом enabled. */
function parsePromptOrder(value: unknown): PromptOrderItem[] | undefined {
  if (!Array.isArray(value) || value.length !== PROMPT_COMPONENT_IDS.length) return undefined;
  const seen = new Set<string>();
  const result: PromptOrderItem[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return undefined;
    const it = item as Record<string, unknown>;
    if (typeof it.id !== "string" || !PROMPT_COMPONENT_IDS.includes(it.id as PromptComponentId)) {
      return undefined;
    }
    if (typeof it.enabled !== "boolean") return undefined;
    if (seen.has(it.id)) return undefined; // дубль
    seen.add(it.id);
    result.push({ id: it.id as PromptComponentId, enabled: it.enabled });
  }
  return result;
}

/**
 * Разбирает тело запроса в RpTemplateInput с ручной валидацией (без отдельной зависимости).
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
export function parseRpTemplateInput(body: unknown): { input: RpTemplateInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  // userPersonaStreaming по умолчанию true (выключается только явным false).
  const userPersonaStreaming = b.userPersonaStreaming !== false;

  const promptOrder = parsePromptOrder(b.promptOrder);
  if (!promptOrder) return { error: "Invalid promptOrder" };

  return {
    input: {
      name,
      systemPrompt: str(b.systemPrompt),
      auxiliarySystemPrompt: str(b.auxiliarySystemPrompt),
      postHistoryInstruction: str(b.postHistoryInstruction),
      userPersonaPrompt: str(b.userPersonaPrompt),
      userPersonaStreaming,
      translationSystemPrompt: str(b.translationSystemPrompt),
      promptOrder,
    },
  };
}
