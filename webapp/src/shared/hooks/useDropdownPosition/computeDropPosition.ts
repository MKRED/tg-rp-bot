export interface DropPosition {
  dir: "up" | "down";
  maxHeight: number;
  /** Сторона, к которой меню прижато по горизонтали — правым краем к триггеру ("end") или левым
   *  ("start"). Актуально только для меню фиксированной/минимальной ширины (LangPicker — компактная
   *  "таблетка", не на всю ширину контейнера); full-width меню (DropdownPicker) это поле не читает. */
  align: "start" | "end";
  /** Доступное место по горизонтали на выбранной align-стороне — так же, как maxHeight, не даёт
   *  меню вылезти за край экрана, если триггер стоит близко к краю. */
  maxWidth: number;
}

export interface DropPositionInsets {
  gap: number;
  margin: number;
  insetTop: number;
  insetBottom: number;
  /** Желаемая минимальная ширина меню (напр. 160px у LangPicker) — используется только чтобы
   *  выбрать align-сторону с бОльшим запасом места, саму ширину не форсирует (см. maxWidth). */
  minMenuWidth: number;
}

/**
 * Чистая геометрия: выбирает сторону раскрытия меню (вверх/вниз, а также прижатие по горизонтали
 * слева/справа от триггера) по реальному месту до края вьюпорта и клампит высоту/ширину РОВНО этим
 * местом — не подкладываем искусственный минимум (напр. Math.max(120, ...)), иначе на выбранной
 * стороне может не хватить места и меню всё равно вылезет за край (тот самый баг, который эта
 * функция чинит: раньше LangPicker был всегда прижат правым краем к триггеру и улетал за левый край
 * экрана, если триггер стоял близко к левому краю, а меню — шире доступного места).
 */
export function computeDropPosition(
  triggerRect: { top: number; bottom: number; left: number; right: number },
  viewport: { width: number; height: number },
  { gap, margin, insetTop, insetBottom, minMenuWidth }: DropPositionInsets,
): DropPosition {
  const top = insetTop + margin;
  const bottom = viewport.height - insetBottom - margin;
  const spaceAbove = triggerRect.top - gap - top;
  const spaceBelow = bottom - triggerRect.bottom - gap;
  const dir = spaceBelow >= spaceAbove ? "down" : "up";
  const maxHeight = Math.max(0, dir === "down" ? spaceBelow : spaceAbove);

  const spaceEnd = triggerRect.right - margin;
  const spaceStart = viewport.width - margin - triggerRect.left;
  const align = spaceEnd >= minMenuWidth || spaceEnd >= spaceStart ? "end" : "start";
  const maxWidth = Math.max(0, align === "end" ? spaceEnd : spaceStart);

  return { dir, maxHeight, align, maxWidth };
}
