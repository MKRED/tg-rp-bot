import logger from "../../logger.js";
import { CARD_LOCK_STALE_MS } from "./cards.constants.js";

/**
 * Лок по cardId, общий между сохранением формы (PUT /:id) и генерацией блока (generateCardBlock,
 * включая паузу на ask_user — см. pendingGeneration.ts).
 *
 * setCardCategoryContent (db/cards/cards.ts) делает read-modify-write всей строки (getCard → патч
 * одной категории → updateCard целиком). Без общего лока параллельный PUT (сохранение формы) в узком
 * окне между этим getCard и updateCard мог бы затереться либо затереть чужую запись — оба пишут
 * полную строку без версии/OCC ("last writer wins"). Сериализуем оба пути через один лок на cardId,
 * как processing-lock в CLAUDE.md (Set<string|number>, снимается в finally).
 *
 * Держит момент захвата (не просто Set) и токен владения: генерация с ask_user держит лок между
 * запросом «вот вопросы» и «вот ответы» (человеческий раунд-трип), и заброшенная вкладка/потерянная
 * сеть не должна занимать карточку навсегда — лок старше CARD_LOCK_STALE_MS можно перезахватить.
 * Токен — страховка от того же TTL для ОБЫЧНОЙ (без ask_user) генерации: если один вызов
 * generateCardBlock (несколько раундов LLM/веб-поиска с ретраями) когда-нибудь займёт дольше TTL,
 * второй caller (PUT/новый generate) перезахватит лок с НОВЫМ токеном, а unlockCard/touchCardLock
 * первого вызова, вооружённые старым токеном, станут no-op вместо того, чтобы втихую снять/обновить
 * чужой лок — без токена это была бы ровно та гонка read-modify-write, от которой лок существует.
 */
interface LockEntry {
  token: number;
  lockedAt: number;
}

let nextToken = 1;
const locked = new Map<number, LockEntry>();

/** Захватывает лок карточки. false — карточка уже занята другой операцией (PUT/generate); иначе —
 * токен владения, который нужно передать в unlockCard/touchCardLock. */
export function tryLockCard(cardId: number): number | false {
  const entry = locked.get(cardId);
  if (entry) {
    if (Date.now() - entry.lockedAt < CARD_LOCK_STALE_MS) return false;
    logger.warn(
      { cardId, staleForMs: Date.now() - entry.lockedAt },
      "cardLock: перезахватываем протухший лок (скорее всего заброшенный ask_user-вопрос)",
    );
  }
  const token = nextToken++;
  locked.set(cardId, { token, lockedAt: Date.now() });
  return token;
}

/** Освобождает лок карточки — только если token совпадает с текущим владельцем (иначе лок уже
 * перезахвачен кем-то другим после протухания TTL, и снимать чужой не нужно). Вызывать в finally. */
export function unlockCard(cardId: number, token: number): void {
  const entry = locked.get(cardId);
  if (!entry || entry.token !== token) return;
  locked.delete(cardId);
}

/**
 * Обновляет момент захвата уже удерживаемого лока (по тому же token) — вызывать сразу перед
 * setPendingGeneration (generateBlock.ts/resumeBlock.ts). Без этого лок отсчитывал бы протухание
 * от начала generate (до LLM-запроса), а pendingGeneration — от момента паузы (после LLM-запроса,
 * который может идти десятки секунд с веб-поиском); лок протухал бы раньше pending-записи, и
 * PUT/generate мог бы перезахватить лок карточки, пока ask_user-пауза ещё жива.
 */
export function touchCardLock(cardId: number, token: number): void {
  const entry = locked.get(cardId);
  if (!entry || entry.token !== token) return;
  entry.lockedAt = Date.now();
}
