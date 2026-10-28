// Контракт API пресетов генерации (/api/presets) — общий для bot и webapp.

/** Уровни рассуждения (по возрастанию бюджета) — ровно те, что принимает DeepSeek (reasoning_effort). */
export const REASONING_EFFORTS = ["low", "high", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

/**
 * Ключи параметров сэмплинга — поля PresetInput типа `number | null`. Только то, что DeepSeek реально
 * применяет: остальные OpenAI-совместимые параметры (top_k, penalties, min_p…) он игнорирует.
 */
export type SamplingKey = "temperature" | "topP";

/**
 * Тело формы создания/правки (POST/PUT), без серверных id/timestamps. Параметры сэмплинга —
 * `number | null`, где null = «не передавать значение». Имена совпадают с колонками БД и с телом
 * запроса к провайдеру. Промпты живут отдельно — в RP- или narrator-шаблоне; пресет режимо-независим.
 * model — id модели DeepSeek (из GET /models); null — модель по умолчанию сервера.
 */
export interface PresetInput extends Record<SamplingKey, number | null> {
  name: string;
  model: string | null;
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
  model: string | null;
  temperature: number | null;
  contextUnlimited: boolean;
  contextSize: number | null;
  maxTokens: number | null;
  streaming: boolean;
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort | null;
}

/** Модель пресета по умолчанию (model: null) и вызовов без пресета — например, перевода текста. */
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";

/**
 * Модели DeepSeek, которые видят картинки (image_url в user-сообщении). Проверено запросами: v4-pro
 * отвечает 200, но молча заменяет картинку на "[Unsupported Image]" — ошибки HTTP не будет, поэтому
 * проверяем модель заранее, а не ловим отказ.
 */
export const DEEPSEEK_VISION_MODELS: readonly string[] = ["deepseek-flash"];

/** Видит ли модель пресета картинки; null — модель по умолчанию (DEFAULT_DEEPSEEK_MODEL). */
export function modelSupportsImages(model: string | null): boolean {
  return DEEPSEEK_VISION_MODELS.includes(model ?? DEFAULT_DEEPSEEK_MODEL);
}

// Мягкий лимит: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_PRESETS_PER_USER = 50;
