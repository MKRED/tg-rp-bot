import type { PresetInput } from "../../db/presets/index.js";
import { REASONING_EFFORTS, SAMPLING_RANGES } from "./presets.constants.js";
import type { SamplingKey } from "./presets.types.js";

/** Параметр сэмплинга: null (не передавать) или число в своём диапазоне. */
function parseSampling(
  value: unknown,
  range: { min: number; max?: number; integer?: boolean },
): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (range.integer && !Number.isInteger(value)) return undefined;
  if (value < range.min) return undefined;
  if (range.max !== undefined && value > range.max) return undefined;
  return value;
}

/** Положительное целое (размер контекста / длина ответа) или null. */
function parsePositiveInt(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return undefined;
  return value;
}

/**
 * Разбирает тело запроса в PresetInput с ручной валидацией (без отдельной зависимости).
 * Возвращает либо распарсенный вход, либо текст ошибки для ответа 400.
 */
export function parsePresetInput(body: unknown): { input: PresetInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Name is required" };

  // Булевы поля.
  const contextUnlimited = b.contextUnlimited === true;
  const streaming = b.streaming === true;
  const requestReasoning = b.requestReasoning === true;

  // Лимиты токенов.
  const contextSize = parsePositiveInt(b.contextSize);
  if (contextSize === undefined) return { error: "contextSize must be a positive integer or null" };
  const maxTokens = parsePositiveInt(b.maxTokens);
  if (maxTokens === undefined) return { error: "maxTokens must be a positive integer or null" };

  // Параметры сэмплинга — собираем в типизированный объект, любой выход за диапазон → 400.
  const sampling = {} as Record<SamplingKey, number | null>;
  for (const key of Object.keys(SAMPLING_RANGES) as SamplingKey[]) {
    const parsed = parseSampling(b[key], SAMPLING_RANGES[key]);
    if (parsed === undefined) return { error: `Invalid value for ${key}` };
    sampling[key] = parsed;
  }

  // reasoningEffort — один из допустимых уровней или null.
  let reasoningEffort: string | null = null;
  if (b.reasoningEffort !== undefined && b.reasoningEffort !== null) {
    if (
      typeof b.reasoningEffort !== "string" ||
      !REASONING_EFFORTS.includes(b.reasoningEffort as (typeof REASONING_EFFORTS)[number])
    ) {
      return { error: "Invalid reasoningEffort" };
    }
    reasoningEffort = b.reasoningEffort;
  }

  return {
    input: {
      name,
      contextUnlimited,
      contextSize,
      maxTokens,
      streaming,
      ...sampling,
      requestReasoning,
      reasoningEffort,
    },
  };
}
