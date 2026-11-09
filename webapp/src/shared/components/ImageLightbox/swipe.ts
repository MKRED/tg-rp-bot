/** Сдвиг пальца, после которого свайп в просмотре листает картинку. */
export const SWIPE_NAV_PX = 60;

/**
 * Направление листания по свайпу: −1 — к предыдущей (палец вправо), +1 — к следующей, null — не свайп
 * (короткий сдвиг или скорее вертикальный жест).
 */
export function swipeDirection(dx: number, dy: number, threshold = SWIPE_NAV_PX): -1 | 1 | null {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}
