import { COMPACT_FLOOR_MIN, type CompactUnavailableReason as StoryCompactReason } from "@tg-rp-bot/shared";
import { DEFAULT_OUTPUT_RESERVE } from "../../prompt/budget.js";

/** Минимальный размер контекста, при котором сжатие имеет смысл (ниже — фича недоступна). */
export const MIN_COMPACT_CONTEXT = 4000;

/** Причина недоступности по пресету (template_off решает шаблон, не пресет). null = доступна. */
export type CompactUnavailableReason = Exclude<StoryCompactReason, "template_off"> | null;

type PresetLike = { contextUnlimited: boolean; contextSize: number | null } | null | undefined;

/** Причина недоступности сжатия по пресету истории (или null, если доступно). */
export function compactUnavailableReason(preset: PresetLike): CompactUnavailableReason {
  if (!preset || preset.contextUnlimited || preset.contextSize == null) return "unlimited";
  if (preset.contextSize < MIN_COMPACT_CONTEXT) return "too_small";
  return null;
}

/** Доступно ли сжатие для пресета истории. */
export function compactAvailable(preset: PresetLike): boolean {
  return compactUnavailableReason(preset) === null;
}

/**
 * Целевой «пол» в токенах с клампингом. 0/«не задано» → дефолт round(contextSize*0.7). Результат
 * зажат в [COMPACT_FLOOR_MIN, contextSize - outputReserve], т.е. строго < contextSize.
 * Вызывать только при доступной фиче (contextSize != null, >= MIN_COMPACT_CONTEXT).
 */
export function resolveCompactFloor(
  storedFloor: number,
  contextSize: number,
  maxTokens: number | null,
): number {
  const outputReserve = maxTokens ?? DEFAULT_OUTPUT_RESERVE;
  const def = Math.round(contextSize * 0.7);
  const maxFloor = Math.max(COMPACT_FLOOR_MIN, contextSize - outputReserve);
  const floor = storedFloor > 0 ? storedFloor : def;
  return Math.max(COMPACT_FLOOR_MIN, Math.min(floor, maxFloor));
}
