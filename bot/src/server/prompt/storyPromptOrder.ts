import type { StoryPromptComponentId, StoryPromptOrderItem } from "../../db/schema.js";
import { DEFAULT_NARRATOR_PROMPT_ORDER } from "./storyPromptBuilder/index.js";

const KNOWN_IDS = new Set<StoryPromptComponentId>(
  DEFAULT_NARRATOR_PROMPT_ORDER.map((i) => i.id),
);

/**
 * Приводит promptOrder к каноническому набору компонентов. Старые шаблоны хранят 6-элементный
 * порядок (без `compact`); чтобы не делать data-миграцию, недостающие канонические компоненты
 * дописываются на их дефолтную позицию (относительно соседей из DEFAULT_NARRATOR_PROMPT_ORDER),
 * сохраняя пользовательский порядок остальных. Неизвестные id и дубли отбрасываются.
 */
export function normalizeStoryPromptOrder(value: unknown): StoryPromptOrderItem[] {
  const incoming = Array.isArray(value) ? value : [];
  const ordered: StoryPromptOrderItem[] = [];
  const present = new Set<StoryPromptComponentId>();

  for (const raw of incoming) {
    if (typeof raw !== "object" || raw === null) continue;
    const it = raw as Record<string, unknown>;
    const id = it.id as StoryPromptComponentId;
    if (typeof it.id !== "string" || !KNOWN_IDS.has(id) || present.has(id)) continue;
    present.add(id);
    ordered.push({ id, enabled: typeof it.enabled === "boolean" ? it.enabled : true });
  }

  // Дописываем недостающие канонические компоненты на их дефолтную позицию: сразу после ближайшего
  // предшествующего (по DEFAULT) уже присутствующего компонента, иначе — в начало.
  DEFAULT_NARRATOR_PROMPT_ORDER.forEach((def, defIdx) => {
    if (present.has(def.id)) return;
    let insertAt = 0;
    for (let j = defIdx - 1; j >= 0; j--) {
      const prevIdx = ordered.findIndex((o) => o.id === DEFAULT_NARRATOR_PROMPT_ORDER[j]!.id);
      if (prevIdx >= 0) {
        insertAt = prevIdx + 1;
        break;
      }
    }
    const entry = { id: def.id, enabled: def.enabled };
    ordered.splice(insertAt, 0, entry);
    present.add(def.id);
  });

  return ordered;
}
