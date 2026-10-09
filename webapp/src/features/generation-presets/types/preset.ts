// Контракт формы/списка, уровни рассуждения и лимит — общие с сервером, живут в пакете @tg-rp-bot/shared.
import type { PresetInput, ReasoningEffort } from "@tg-rp-bot/shared";

export type { PresetInput, PresetListItem, ReasoningEffort } from "@tg-rp-bot/shared";
export { MAX_PRESETS_PER_USER, REASONING_EFFORTS } from "@tg-rp-bot/shared";

/** Человекочитаемые подписи уровней рассуждения. */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  minimal: "Минимальное",
  low: "Низкое",
  medium: "Среднее",
  high: "Высокое",
  xhigh: "Очень высокое",
  max: "Максимальное",
  ultra: "Ультра",
};

/** Полный пресет, как его отдаёт сервер (GET /presets/:id). */
export interface Preset extends PresetInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}
