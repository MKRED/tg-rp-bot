/** Доля ширины экрана, после которой отпущенная картинка уходит на соседнюю. */
const DISTANCE_SHARE = 0.25;
/** Быстрый бросок (px/с) листает даже на коротком сдвиге — как в галерее телефона. */
const FLICK_VELOCITY = 500;
/** Короче этого бросок не считается, сколь бы быстрым он ни был (дрожь пальца при тапе). */
const MIN_FLICK_PX = 20;

/**
 * Куда листать после отпускания ленты: −1 — к предыдущей (лента сдвинута вправо), +1 — к следующей,
 * 0 — вернуться на место. На краях (нет соседней) — всегда 0.
 */
export function swipeStep(offset: number, velocity: number, width: number, hasPrev: boolean, hasNext: boolean): -1 | 0 | 1 {
  const far = Math.abs(offset) > width * DISTANCE_SHARE;
  const flick = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(offset) > MIN_FLICK_PX && Math.sign(velocity) === Math.sign(offset);
  if (!far && !flick) return 0;
  if (offset < 0) return hasNext ? 1 : 0;
  return hasPrev ? -1 : 0;
}
