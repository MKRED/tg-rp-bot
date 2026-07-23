import { countTokens } from "../../utils/index.js";

interface TemplateOwnedFields {
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
}

interface PromptOrderEntry {
  id: string;
  enabled: boolean;
}

/**
 * Сумма токенов template-полей, которые реально принадлежат шаблону (system/auxiliary/
 * postHistory) — остальные компоненты promptOrder берутся из других сущностей (персонаж,
 * персона, книга знаний, история чата) и в вес шаблона не входят. Общий для RP- и
 * narrator-шаблонов: у обоих одни и те же три id. Считаем только enabled-компоненты — как их
 * реально соберёт buildMessages/storyPromptBuilder. Точный подсчёт (не len/4): список шаблонов
 * показывает то же число, что и tokensPrompt на экране статистики чата (chats/stats.handler.ts).
 */
export function templateTokenWeight(
  fields: TemplateOwnedFields,
  promptOrder: PromptOrderEntry[],
): number {
  const enabled = new Set(promptOrder.filter((c) => c.enabled).map((c) => c.id));
  let total = 0;
  if (enabled.has("system")) total += countTokens(fields.systemPrompt);
  if (enabled.has("auxiliary")) total += countTokens(fields.auxiliarySystemPrompt);
  if (enabled.has("postHistory")) total += countTokens(fields.postHistoryInstruction);
  return total;
}
