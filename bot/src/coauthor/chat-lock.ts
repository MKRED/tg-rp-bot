/**
 * Лок по id чата соавтора и память о последней ошибке хода — в памяти процесса, как card-lock.ts
 * (прод — один процесс, после рестарта идущих ходов нет).
 *
 * Все записи в чат делают read-modify-write всего зашифрованного state, поэтому ход ИИ, ответ на
 * вопросы, решение по правкам и правка настроек сериализуются этим локом. Лок держит и ход целиком
 * (десятки секунд): пока он взят, GET отдаёт running — так страница, обновлённая посреди хода,
 * понимает, что ответ ещё будет.
 */
const locked = new Set<number>();

/** Сколько помнить ошибку упавшего хода: клиент опрашивает чат после обновления страницы. */
const ERROR_TTL_MS = 10 * 60 * 1000;
const lastErrors = new Map<number, { code: string; expiresAt: number }>();

export function tryLockChat(chatId: number): boolean {
  if (locked.has(chatId)) return false;
  locked.add(chatId);
  return true;
}

export function unlockChat(chatId: number): void {
  locked.delete(chatId);
}

export function isChatLocked(chatId: number): boolean {
  return locked.has(chatId);
}

export function setTurnError(chatId: number, code: string): void {
  lastErrors.set(chatId, { code, expiresAt: Date.now() + ERROR_TTL_MS });
}

export function clearTurnError(chatId: number): void {
  lastErrors.delete(chatId);
}

export function getTurnError(chatId: number): string | undefined {
  const entry = lastErrors.get(chatId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    lastErrors.delete(chatId);
    return undefined;
  }
  return entry.code;
}
