import { Hono } from "hono";
import { ensureUser } from "../db/users.js";
import {
  type PresetInput,
  countPresets,
  createPreset,
  deletePreset,
  getPreset,
  listPresets,
  updatePreset,
} from "../db/presets.js";
import type { PromptComponentId, PromptOrderItem } from "../db/schema.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";

/** Проверяет, является ли ошибка нарушением FK-ограничения PostgreSQL (SQLSTATE 23503).
 *  DrizzleQueryError оборачивает нативный PostgresError (postgres.js) в поле .cause,
 *  поэтому проверяем оба уровня — иначе code === "23503" не находится на верхнем уровне. */
const isFkViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e.code === "23503") return true;
  const cause = e.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in (cause as object) &&
    (cause as Record<string, unknown>).code === "23503"
  );
};

// Мягкий лимит (дублируется в webapp для блокировки UI — здесь последняя линия защиты).
const MAX_PRESETS_PER_USER = 50;

// Допустимые уровни рассуждения OpenRouter (по возрастанию бюджета).
const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;

// Канонический набор компонентов запроса — promptOrder обязан содержать ровно их (по разу).
const PROMPT_COMPONENT_IDS: PromptComponentId[] = [
  "system",
  "characterDescription",
  "userDescription",
  "auxiliary",
  "history",
  "postHistory",
];

/** Ключи параметров сэмплинга — поля PresetInput типа number|null. */
type SamplingKey =
  | "temperature"
  | "topP"
  | "topK"
  | "frequencyPenalty"
  | "presencePenalty"
  | "repetitionPenalty"
  | "minP"
  | "topA";

/**
 * Диапазоны параметров сэмплинга (официальные значения OpenRouter). topK без верхней границы
 * («0 or above») — проверяем только неотрицательность и целочисленность.
 */
const SAMPLING_RANGES: Record<SamplingKey, { min: number; max?: number; integer?: boolean }> = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  topK: { min: 0, integer: true },
  frequencyPenalty: { min: -2, max: 2 },
  presencePenalty: { min: -2, max: 2 },
  repetitionPenalty: { min: 0, max: 2 },
  minP: { min: 0, max: 1 },
  topA: { min: 0, max: 1 },
};

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
function parsePresetInput(body: unknown): { input: PresetInput } | { error: string } {
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

/**
 * CRUD-роуты пресетов под /api/presets. Монтируются из routes.ts ПОСЛЕ requireInitData,
 * поэтому здесь c.get("tgUser") уже доступен. Все запросы изолированы по владельцу (user_id).
 */
export function createPresetRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Список пресетов текущего пользователя (id + название).
  api.get("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      const presets = await listPresets(user.id);
      return c.json({ presets });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to list presets");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Один пресет целиком (только свой).
  api.get("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const preset = await getPreset(user.id, id);
      if (!preset) return c.json({ error: "Not found" }, 404);
      return c.json({ preset });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to get preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Создание пресета.
  api.post("/", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);

    const parsed = parsePresetInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      // Сначала гарантируем строку в users (FK), затем проверяем лимит.
      await ensureUser(user);
      if ((await countPresets(user.id)) >= MAX_PRESETS_PER_USER) {
        return c.json({ error: `Preset limit reached (max ${MAX_PRESETS_PER_USER})` }, 400);
      }
      const preset = await createPreset(user.id, parsed.input);
      return c.json({ preset }, 201);
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to create preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Обновление пресета (только своего).
  api.put("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const parsed = parsePresetInput(await c.req.json().catch(() => null));
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    try {
      const preset = await updatePreset(user.id, id, parsed.input);
      if (!preset) return c.json({ error: "Not found" }, 404);
      return c.json({ preset });
    } catch (err) {
      logger.error({ err, userId: user.id, id }, "Failed to update preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Удаление пресета (только своего).
  api.delete("/:id", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
    try {
      const deleted = await deletePreset(user.id, id);
      if (!deleted) return c.json({ error: "Not found" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      // FK нарушение (23503): пресет привязан к чату.
      if (isFkViolation(err)) return c.json({ error: "in_use" }, 409);
      logger.error({ err, userId: user.id, id }, "Failed to delete preset");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
