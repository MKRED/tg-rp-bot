/** Сдвиг пальца, до которого касание — ещё тап, а не протяжка. */
const TAP_MOVE_PX = 10;
/** Дольше — это удержание, а не тап. */
const TAP_MAX_MS = 300;
/** Окно двойного тапа: второй тап в нём — зум, а не повторное переключение панелей. */
export const DOUBLE_TAP_MS = 300;

/** Касание было тапом: палец почти не сдвинулся и быстро отпущен. */
export function isTap(dx: number, dy: number, durationMs: number): boolean {
  return Math.hypot(dx, dy) < TAP_MOVE_PX && durationMs < TAP_MAX_MS;
}

/** Второй тап двойного — не дальше этого от первого (палец попадает не в ту же точку). */
const DOUBLE_TAP_RADIUS_PX = 40;

/** Второй тап рядом с первым — пара складывается в двойной тап. */
export function isNearTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < DOUBLE_TAP_RADIUS_PX;
}
