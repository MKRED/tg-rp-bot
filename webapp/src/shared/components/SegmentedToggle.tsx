import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import "./SegmentedToggle.css";

export interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: readonly SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

/**
 * Сегмент-тумблер с «таблеткой», скользящей под активным сегментом. Геометрия (left/width)
 * измеряется по offsetLeft/offsetWidth активной кнопки, а не layout-проекцией framer — иначе
 * рефлоу контейнера (напр. рост шторы вверх) дёргал бы таблетку по вертикали.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedToggleProps<T>) {
  const btnRefs = useRef(new Map<T, HTMLButtonElement>());
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = btnRefs.current.get(value);
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);

  return (
    <div className="segmented-toggle" role="tablist" aria-label={ariaLabel}>
      {thumb && (
        <motion.span
          aria-hidden
          className="segmented-toggle__thumb"
          initial={false}
          animate={{ left: thumb.left, width: thumb.width }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          ref={(el) => {
            if (el) btnRefs.current.set(o.value, el);
            else btnRefs.current.delete(o.value);
          }}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`segmented-toggle__btn${value === o.value ? " is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          <span className="segmented-toggle__btn-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
