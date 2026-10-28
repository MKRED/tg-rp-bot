// Контракт формы/списка, уровни рассуждения и лимит — общие с сервером, живут в пакете @tg-rp-bot/shared.
import type { PresetInput, ReasoningEffort } from "@tg-rp-bot/shared";

export type { PresetInput, PresetListItem, ReasoningEffort } from "@tg-rp-bot/shared";
export { DEFAULT_DEEPSEEK_MODEL, MAX_PRESETS_PER_USER, REASONING_EFFORTS } from "@tg-rp-bot/shared";

/** Подписи уровней (глубины) рассуждения — короткие: идут в SegmentedControl на три кнопки. */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  low: "Низкая",
  high: "Высокая",
  max: "Макс.",
};

/** Полный пресет, как его отдаёт сервер (GET /presets/:id). */
export interface Preset extends PresetInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}
