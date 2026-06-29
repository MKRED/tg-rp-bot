import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface LangOption {
  value: string;
  label: string;
}

interface LangPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Список языков (передаётся фичей: LANG_OPTIONS у RP/narrator одинаков, но живёт в каждой фиче). */
  options: LangOption[];
}

// Сколько места по вертикали меню хочет занять и какой зазор оставить от края экрана.
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Пикер целевого языка перевода. Вместо нативного <select> рисует свой список прямо в интерфейсе
 * шторы (нативное меню в Telegram webview выглядит чужеродно). Закрывается по выбору или клику вне.
 */
export function LangPicker({ value, onChange, options }: LangPickerProps) {
  const [open, setOpen] = useState(false);
  // Направление и максимальная высота меню считаются при открытии по реальному месту вокруг
  // триггера: штора растёт вверх от появления результата и сдвигает переключатель к верху экрана,
  // где раскрытие вверх обрезалось бы. Выбираем сторону с бо́льшим запасом и ограничиваем высоту.
  const [drop, setDrop] = useState<{ dir: "up" | "down"; maxHeight: number }>({
    dir: "up",
    maxHeight: 0,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
      const dir = spaceBelow > spaceAbove ? "down" : "up";
      setDrop({ dir, maxHeight: Math.max(120, dir === "down" ? spaceBelow : spaceAbove) });
    }
    setOpen((v) => !v);
  };

  // Закрытие по клику вне пикера.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className="lang-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="lang-picker__trigger"
        onClick={openMenu}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Язык перевода"
      >
        <span>{current?.label ?? value}</span>
        <ChevronDown
          size={16}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <ul
          className={`lang-picker__menu lang-picker__menu--${drop.dir}`}
          role="listbox"
          style={{ maxHeight: drop.maxHeight }}
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`lang-picker__option${o.value === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
