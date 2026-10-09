import {
  COMPACT_FLOOR_MAX_SHARE,
  COMPACT_FLOOR_MIN,
  type CompactUnavailableReason as StoryCompactReason,
} from "@tg-rp-bot/shared";
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

/**
 * Сохраняемое значение «пола» из настроек (PUT settings): клампим в границы слайдера webapp —
 * [COMPACT_FLOOR_MIN, round(contextSize × COMPACT_FLOOR_MAX_SHARE)]. Нет лимита контекста (нет
 * пресета, безграничный, размер не задан) — фича недоступна, но значение всё равно сохраняем сырым
 * (≥ 0): пригодится, если пресет потом получит лимит.
 */
export function clampStoredCompactFloor(raw: number, preset: PresetLike): number {
  const contextSize = preset && !preset.contextUnlimited ? preset.contextSize : null;
  if (contextSize == null) return Math.max(0, raw);
  return Math.max(COMPACT_FLOOR_MIN, Math.min(raw, Math.round(contextSize * COMPACT_FLOOR_MAX_SHARE)));
}
