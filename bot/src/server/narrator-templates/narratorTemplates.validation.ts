import type { NarratorTemplateInput } from "../../db/narratorTemplates/index.js";
import type { StoryPromptComponentId, StoryPromptOrderItem } from "../../db/schema.js";
import { DEFAULT_NARRATOR_PROMPT_ORDER } from "../prompt/storyPromptBuilder.js";
import { STORY_PROMPT_COMPONENT_IDS } from "./narratorTemplates.constants.js";

/** promptOrder: массив ровно из известных компонентов (по разу) с boolean-флагом enabled. */
function parsePromptOrder(value: unknown): StoryPromptOrderItem[] | undefined {
  if (!Array.isArray(value) || value.length !== STORY_PROMPT_COMPONENT_IDS.length) return undefined;
  const seen = new Set<string>();
  const result: StoryPromptOrderItem[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return undefined;
    const it = item as Record<string, unknown>;
    if (
      typeof it.id !== "string" ||
      !STORY_PROMPT_COMPONENT_IDS.includes(it.id as StoryPromptComponentId)
    ) {
      return undefined;
    }
    if (typeof it.enabled !== "boolean") return undefined;
    if (seen.has(it.id)) return undefined; // дубль
    seen.add(it.id);
    result.push({ id: it.id as StoryPromptComponentId, enabled: it.enabled });
  }
  return result;
}

export function parseNarratorTemplateInput(
  body: unknown,
): { input: NarratorTemplateInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  // Порядок необязателен в запросе: если не пришёл — берём дефолт; если пришёл битым — 400.
  const promptOrder =
    b.promptOrder === undefined ? DEFAULT_NARRATOR_PROMPT_ORDER : parsePromptOrder(b.promptOrder);
  if (!promptOrder) return { error: "Invalid promptOrder" };
  return {
    input: {
      name: name.slice(0, 100),
      systemPrompt: str(b.systemPrompt),
      auxiliarySystemPrompt: str(b.auxiliarySystemPrompt),
      postHistoryInstruction: str(b.postHistoryInstruction),
      translationSystemPrompt: str(b.translationSystemPrompt),
      promptOrder,
    },
  };
}
