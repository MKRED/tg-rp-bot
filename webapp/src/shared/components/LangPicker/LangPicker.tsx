import { Caption } from "@telegram-apps/telegram-ui";
import { Check, ChevronDown } from "lucide-react";
import { useDropdownPosition } from "../../hooks/useDropdownPosition";
import "./LangPicker.css";

export interface LangOption {
  value: string;
  label: string;
  /** Сокращённая метка (напр. "En" вместо "English") — используется на кнопке-триггере при compact. */
  shortLabel?: string;
}

interface LangPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Список языков (передаётся фичей: LANG_OPTIONS у RP/narrator одинаков, но живёт в каждой фиче). */
  options: LangOption[];
  /** Кнопка-триггер показывает shortLabel вместо label — экономит место в тесных тулбарах. Список
   * при раскрытии всегда с полными названиями (compact не влияет на распознаваемость варианта). */
  compact?: boolean;
}

/**
 * Пикер целевого языка перевода. Вместо нативного <select> рисует свой список прямо в интерфейсе
 * шторы (нативное меню в Telegram webview выглядит чужеродно). Направление раскрытия и высота —
 * общий useDropdownPosition (тот же кусок использует DropdownPicker в generation-presets/
 * llm-settings); здесь остаётся свой компактный pill-вариант разметки/CSS. Закрывается по выбору,
 * клику вне или скролл.
 */
export function LangPicker({ value, onChange, options, compact }: LangPickerProps) {
  const { open, dir, maxHeight, align, maxWidth, rootRef, triggerRef, toggle, close } = useDropdownPosition();

  const current = options.find((o) => o.value === value);
  const triggerLabel = (compact ? current?.shortLabel : undefined) ?? current?.label ?? value;

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
        <Caption level="1">{triggerLabel}</Caption>
        <ChevronDown
          size={16}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <ul
          className={`lang-picker__menu lang-picker__menu--${dir} lang-picker__menu--${align}`}
          role="listbox"
          style={{ maxHeight, maxWidth, minWidth: Math.min(160, maxWidth) }}
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
                <Caption level="1">{o.label}</Caption>
                {o.value === value && <Check size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
