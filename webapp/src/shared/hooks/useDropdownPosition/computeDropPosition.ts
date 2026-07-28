export interface DropPosition {
  dir: "up" | "down";
  maxHeight: number;
}

export interface DropPositionInsets {
  gap: number;
  margin: number;
  insetTop: number;
  insetBottom: number;
}

/**
 * Чистая геометрия: выбирает сторону раскрытия меню (вверх/вниз от триггера) по реальному месту
 * до края вьюпорта и клампит высоту РОВНО этим местом — не подкладываем искусственный минимум
 * (напр. Math.max(120, ...)), иначе на выбранной стороне может не хватить места и меню всё равно
 * вылезет за край, растягивая скролл страницы (тот самый баг, который эта функция чинит).
 */
export function computeDropPosition(
  triggerRect: { top: number; bottom: number },
  viewportHeight: number,
  { gap, margin, insetTop, insetBottom }: DropPositionInsets,
): DropPosition {
  const top = insetTop + margin;
  const bottom = viewportHeight - insetBottom - margin;
  const spaceAbove = triggerRect.top - gap - top;
  const spaceBelow = bottom - triggerRect.bottom - gap;
  const dir = spaceBelow >= spaceAbove ? "down" : "up";
  return { dir, maxHeight: Math.max(0, dir === "down" ? spaceBelow : spaceAbove) };
}
