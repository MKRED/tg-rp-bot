import type { NarratorTemplateInput } from "../../db/narratorTemplates/index.js";
import { DEFAULT_NARRATOR_PROMPT_ORDER } from "../prompt/storyPromptBuilder/index.js";
import { normalizeStoryPromptOrder } from "../prompt/storyPromptOrder.js";

export function parseNarratorTemplateInput(
  body: unknown,
): { input: NarratorTemplateInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  // Маркеры — не «текст промпта» с фолбэком на дефолт, а часть механики сборки массива сообщений
  // (см. storyPromptBuilder): пустая строка сломала бы нейтрализацию/leading-user, поэтому обязательны.
  const continueMarker = typeof b.continueMarker === "string" ? b.continueMarker.trim() : "";
  if (!continueMarker) return { error: "Continue marker is required" };
  const leadingUserMarker = typeof b.leadingUserMarker === "string" ? b.leadingUserMarker.trim() : "";
  if (!leadingUserMarker) return { error: "Leading user marker is required" };
  // Порядок необязателен в запросе: если не пришёл — берём дефолт; иначе нормализуем к каноническому
  // набору (дописываем недостающие компоненты, отбрасываем неизвестные/дубли — без 400).
  const promptOrder =
    b.promptOrder === undefined
      ? DEFAULT_NARRATOR_PROMPT_ORDER
      : normalizeStoryPromptOrder(b.promptOrder);
  return {
    input: {
      name: name.slice(0, 100),
      systemPrompt: str(b.systemPrompt),
      auxiliarySystemPrompt: str(b.auxiliarySystemPrompt),
      postHistoryInstruction: str(b.postHistoryInstruction),
      translationSystemPrompt: str(b.translationSystemPrompt),
      compactionPrompt: str(b.compactionPrompt),
      continueMarker,
      leadingUserMarker,
      promptOrder,
      mergeSystemPrompts: b.mergeSystemPrompts === true,
    },
  };
}
