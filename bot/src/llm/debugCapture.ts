import logger from "../logger.js";
import type { LlmDebugRecord } from "./debug.types.js";
import {
  clampMaxRequests,
  DEFAULT_DEBUG_SETTINGS,
  type LlmDebugSettings,
} from "./debugSettings.js";

// Типы перехвата живут в debug.types.ts; реэкспорт сохраняет прежнюю точку импорта (client.ts).
export type { LlmCallLabel, LlmDebugRecord, LlmDebugResponse } from "./debug.types.js";

/**
 * In-memory перехват RAW-запросов к LLM для отладочного экрана Mini App.
 *
 * Единственная точка вызова — `chatCompletion` (client.ts), поэтому сюда попадают ВСЕ пути:
 * RP-генерация, impersonate, нарратор, перевод. Сами записи живут в памяти процесса (один
 * контейнер на проде) и сбрасываются при рестарте — это осознанно: там расшифрованные
 * сообщения, копить их на диске/в БД не хочется, а смотрят их «вживую».
 *
 * Настройки (тумблер + N) персистятся в БД (user_settings), а здесь держатся в кэше per-user:
 * перехват — горячий путь и не должен ходить в БД на каждый вызов. Кэш праймится на старте
 * (primeDebugSettings) и обновляется из роутов при чтении/изменении настроек.
 *
 * Усечение длинного `messages[]` здесь НЕ делаем: храним запрос целиком, а сколько сообщений
 * показать с краёв — настраивается на самом экране и применяется на клиенте.
 */

// Перехвату нужны только эти два поля (headMessages/tailMessages — про показ, на сервере не нужны).
type CaptureSettings = { enabled: boolean; maxRequests: number };
const CAPTURE_DEFAULTS: CaptureSettings = {
  enabled: DEFAULT_DEBUG_SETTINGS.enabled,
  maxRequests: DEFAULT_DEBUG_SETTINGS.maxRequests,
};

// Кэш настроек per-user (источник истины — БД; здесь копия для горячего пути).
const settingsCache = new Map<number, CaptureSettings>();
// Глобальное кольцо записей; чтение/тримминг — по userId.
let records: LlmDebugRecord[] = [];
let nextId = 1;

/** Эффективные настройки пользователя: из кэша или дефолт (в т.ч. для userId=null). */
function effectiveSettings(userId: number | null): CaptureSettings {
  if (userId == null) return CAPTURE_DEFAULTS;
  return settingsCache.get(userId) ?? CAPTURE_DEFAULTS;
}

/** Положить настройки пользователя в кэш (после чтения/записи в БД или при прайме). */
export function cacheDebugSettings(userId: number, s: LlmDebugSettings): void {
  settingsCache.set(userId, { enabled: s.enabled, maxRequests: clampMaxRequests(s.maxRequests) });
  // При уменьшении N подрезаем уже накопленные записи этого пользователя сразу.
  trimUser(userId);
}

/** Прайм кэша на старте сервера: заливаем все известные настройки разом. */
export function primeDebugSettings(rows: Array<{ userId: number } & LlmDebugSettings>): void {
  for (const r of rows) {
    settingsCache.set(r.userId, { enabled: r.enabled, maxRequests: clampMaxRequests(r.maxRequests) });
  }
  logger.debug({ count: rows.length }, "LLM debug settings cache primed");
}

/** Записи пользователя (последние сверху). Фильтр по userId — каждый видит только свои. */
export function getDebugRecords(userId: number): LlmDebugRecord[] {
  return records.filter((r) => r.userId === userId).reverse();
}

/** Очистить записи пользователя (кнопка «Очистить» на экране). */
export function clearDebugRecords(userId: number): void {
  records = records.filter((r) => r.userId !== userId);
}

/** Подрезать записи одного пользователя до его maxRequests (выкидываем самые старые). */
function trimUser(userId: number | null): void {
  const max = effectiveSettings(userId).maxRequests;
  const userRecs = records.filter((r) => r.userId === userId);
  if (userRecs.length <= max) return;
  const dropIds = new Set(userRecs.slice(0, userRecs.length - max).map((r) => r.id));
  records = records.filter((r) => !dropIds.has(r.id));
}

/**
 * Зарегистрировать один вызов LLM (вызывается из client.ts в finally — и на успехе, и на ошибке).
 * Если перехват для этого пользователя выключен тумблером — ничего не делаем.
 */
export function recordLlmCall(entry: Omit<LlmDebugRecord, "id">): void {
  if (!effectiveSettings(entry.userId).enabled) return;
  records.push({ id: nextId++, ...entry });
  trimUser(entry.userId);
}
