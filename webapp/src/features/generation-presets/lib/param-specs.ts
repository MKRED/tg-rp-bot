import type { PresetInput } from "../types/preset";

/** Ключи параметров сэмплинга в PresetInput (все они `number | null`). */
export type SamplingKey =
  | "temperature"
  | "frequencyPenalty"
  | "presencePenalty"
  | "topK"
  | "topP"
  | "repetitionPenalty"
  | "minP"
  | "topA";

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
  /** Значение по умолчанию при включении тумблера (совпадает с дефолтом OpenRouter). */
  default: number;
}

/**
 * Единый источник описаний параметров сэмплинга: им управляются и слайдеры формы, и подписи.
 * Диапазоны/дефолты — официальные значения OpenRouter (docs/api/reference/parameters).
 * topK без верхней границы у провайдера («0 or above») — в UI кап 100 ради удобства слайдера;
 * серверная валидация (bot/src/server/presets/presets.validation.ts) ограничивает только снизу.
 * Порядок массива = порядок отображения в форме.
 */
export const SAMPLING_SPECS: SamplingSpec[] = [
  {
    key: "temperature",
    label: "Температура",
    hint: "Степень случайности: выше — разнообразнее и неожиданнее, ниже — предсказуемее.",
    min: 0,
    max: 2,
    step: 0.01,
    default: 1,
  },
  {
    key: "frequencyPenalty",
    label: "Штраф за частоту",
    hint: "Сильнее наказывает токены тем больше, чем чаще они уже встречались. Снижает повторы.",
    min: -2,
    max: 2,
    step: 0.01,
    default: 0,
  },
  {
    key: "presencePenalty",
    label: "Штраф за присутствие",
    hint: "Наказывает токен за сам факт появления (независимо от числа). Подталкивает к новым темам.",
    min: -2,
    max: 2,
    step: 0.01,
    default: 0,
  },
  {
    key: "topK",
    label: "Top K",
    hint: "Ограничивает выбор K самыми вероятными токенами. 0 — без ограничения.",
    min: 0,
    max: 100,
    step: 1,
    default: 0,
  },
  {
    key: "topP",
    label: "Top P",
    hint: "Nucleus sampling: берёт токены, пока их суммарная вероятность не достигнет P.",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1,
  },
  {
    key: "repetitionPenalty",
    label: "Штраф за повторы",
    hint: "Снижает вероятность уже встречавшихся токенов. Выше — меньше повторов, но риск потери связности.",
    min: 0,
    max: 2,
    step: 0.01,
    default: 1,
  },
  {
    key: "minP",
    label: "Min P",
    hint: "Минимальная вероятность токена относительно самого вероятного. Отсекает маловероятные варианты.",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
  },
  {
    key: "topA",
    label: "Top A",
    hint: "Отсекает токены по порогу, зависящему от вероятности лучшего токена. Меньше — у́же выбор.",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
  },
];

// Проверка на этапе типов: каждый key спецификации обязан быть полем PresetInput типа number|null.
type _AssertKeys = SamplingKey extends keyof PresetInput ? true : never;
const _assert: _AssertKeys = true;
void _assert;
