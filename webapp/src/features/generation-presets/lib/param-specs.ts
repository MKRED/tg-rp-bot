import type { SamplingKey } from "@tg-rp-bot/shared";
import type { PresetInput } from "../types/preset";

/** Ключи параметров сэмплинга в PresetInput (все они `number | null`) — общие с сервером. */
export type { SamplingKey } from "@tg-rp-bot/shared";

/** Локальное состояние одного параметра в форме: значение + включён ли он в запрос. */
export interface SamplingFieldState {
  value: number;
  enabled: boolean;
}

export type SamplingState = Record<SamplingKey, SamplingFieldState>;

export interface SamplingSpec {
  key: SamplingKey;
  label: string;
  /** Подсказка: на что влияет параметр. */
  hint: string;
  min: number;
  max: number;
  step: number;
  /** Значение по умолчанию при включении тумблера (дефолт DeepSeek API). */
  default: number;
}

/**
 * Описания параметров сэмплинга: им управляются слайдеры формы. Диапазоны и дефолты — из
 * документации DeepSeek (create-chat-completion). Где какой параметр действует — model-rules.ts.
 */
export const SAMPLING_SPECS: Record<SamplingKey, SamplingSpec> = {
  temperature: {
    key: "temperature",
    label: "Температура",
    hint: "Выше — разнообразнее и неожиданнее, ниже — предсказуемее.",
    min: 0,
    max: 2,
    step: 0.01,
    default: 1,
  },
  topP: {
    key: "topP",
    label: "Top P",
    hint: "Берёт токены, пока их суммарная вероятность не достигнет P.",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1,
  },
};

// Проверка на этапе типов: каждый key спецификации обязан быть полем PresetInput типа number|null.
type _AssertKeys = SamplingKey extends keyof PresetInput ? true : never;
const _assert: _AssertKeys = true;
void _assert;
