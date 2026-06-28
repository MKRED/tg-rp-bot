import type { PresetInput } from "../../db/presets/index.js";
import type { PromptComponentId, PromptOrderItem } from "../../db/schema.js";
import { PROMPT_COMPONENT_IDS, REASONING_EFFORTS, SAMPLING_RANGES } from "./presets.constants.js";
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

/** promptOrder: массив ровно из известных компонентов (по разу) с boolean-флагом enabled. */
function parsePromptOrder(value: unknown): PromptOrderItem[] | undefined {
  if (!Array.isArray(value) || value.length !== PROMPT_COMPONENT_IDS.length) return undefined;
  const seen = new Set<string>();
  const result: PromptOrderItem[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return undefined;
    const it = item as Record<string, unknown>;
    if (typeof it.id !== "string" || !PROMPT_COMPONENT_IDS.includes(it.id as PromptComponentId)) {
      return undefined;
    }
    if (typeof it.enabled !== "boolean") return undefined;
    if (seen.has(it.id)) return undefined; // дубль
    seen.add(it.id);
    result.push({ id: it.id as PromptComponentId, enabled: it.enabled });
  }
  return result;
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
  // userPersonaStreaming по умолчанию true (выключается только явным false).
  const userPersonaStreaming = b.userPersonaStreaming !== false;

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

  // Промпты — строки (отсутствует → пусто).
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

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

  const promptOrder = parsePromptOrder(b.promptOrder);
  if (!promptOrder) return { error: "Invalid promptOrder" };

  return {
    input: {
      name,
      contextUnlimited,
      contextSize,
      maxTokens,
      streaming,
      ...sampling,
      systemPrompt: str(b.systemPrompt),
      auxiliarySystemPrompt: str(b.auxiliarySystemPrompt),
      postHistoryInstruction: str(b.postHistoryInstruction),
      userPersonaPrompt: str(b.userPersonaPrompt),
      userPersonaStreaming,
      translationSystemPrompt: str(b.translationSystemPrompt),
      requestReasoning,
      reasoningEffort,
      promptOrder,
    },
  };
}
