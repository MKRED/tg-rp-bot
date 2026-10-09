// Контракт API пресетов генерации (/api/presets) — общий для bot и webapp.

/**
 * Уровни рассуждения (по возрастанию бюджета) — провайдеро-независимый набор. Каждый провайдер
 * схлопывает его в свои значения (DeepSeek — mapEffort в bot/src/llm/providers.ts).
 */
export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

/** Ключи параметров сэмплинга — поля PresetInput типа `number | null`. */
export type SamplingKey =
  | "temperature"
  | "topP"
  | "topK"
  | "frequencyPenalty"
  | "presencePenalty"
  | "repetitionPenalty"
  | "minP"
  | "topA";

/**
 * Тело формы создания/правки (POST/PUT), без серверных id/timestamps. Параметры сэмплинга —
 * `number | null`, где null = «не передавать значение». Имена совпадают с колонками БД и с телом
 * запроса к провайдеру. Промпты живут отдельно — в RP- или narrator-шаблоне; пресет режимо-независим.
 */
export interface PresetInput extends Record<SamplingKey, number | null> {
  name: string;
  contextUnlimited: boolean;
  contextSize: number | null;
  maxTokens: number | null;
  streaming: boolean;
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort | null;
}

/**
 * Лёгкая строка списка (GET /presets): id, название и скалярные поля для сводки под названием.
 * Остальной сэмплинг нужен только в форме правки — список его не тянет.
 */
export interface PresetListItem {
  id: number;
  name: string;
  temperature: number | null;
  contextUnlimited: boolean;
  contextSize: number | null;
  maxTokens: number | null;
  streaming: boolean;
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort | null;
}

// Мягкий лимит: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_PRESETS_PER_USER = 50;
