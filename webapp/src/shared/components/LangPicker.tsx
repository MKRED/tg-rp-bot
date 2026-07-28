import { Check, ChevronDown } from "lucide-react";
import { useDropdownPosition } from "../hooks/useDropdownPosition";

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

/**
 * Пикер целевого языка перевода. Вместо нативного <select> рисует свой список прямо в интерфейсе
 * шторы (нативное меню в Telegram webview выглядит чужеродно). Направление раскрытия и высота —
 * общий useDropdownPosition (тот же кусок использует DropdownPicker в generation-presets/
 * llm-settings); здесь остаётся свой компактный pill-вариант разметки/CSS. Закрывается по выбору,
 * клику вне или скролл.
 */
export function LangPicker({ value, onChange, options }: LangPickerProps) {
  const { open, dir, maxHeight, rootRef, triggerRef, toggle, close } = useDropdownPosition();

  const current = options.find((o) => o.value === value);

  return (
    <div className="lang-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="lang-picker__trigger"
        onClick={toggle}
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
          className={`lang-picker__menu lang-picker__menu--${dir}`}
          role="listbox"
          style={{ maxHeight }}
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
                  close();
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
