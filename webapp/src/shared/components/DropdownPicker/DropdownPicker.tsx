import { Check, ChevronDown } from "lucide-react";
import { useDropdownPosition } from "../../hooks/useDropdownPosition";
import "./DropdownPicker.css";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownPickerProps<T extends string> {
  value: T | null;
  options: readonly PickerOption<T>[];
  onChange: (value: T) => void;
  header?: string;
  subtitle?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Full-width выпадающий список вместо нативного <select> — Telegram webview на ПК (Chromium)
 * рисует нативный попап системно-белым, светлый текст на нём не виден. Раскрывается вверх или вниз
 * по реальному месту вокруг триггера (useDropdownPosition), поэтому не растягивает страницу, если
 * триггер оказался у нижнего края экрана. Компактный pill-вариант с другим anchor'ом — отдельный
 * LangPicker (штора перевода), сюда не сведён из-за другого визуального контракта.
 *
 * Типографика subhead/subtitle скопирована с tgui `Cell` (15px, цвета subtitle_text_color/hint_color),
 * а сам триггер оформлен как поле `Input`/`FormInput` на базовой платформе — без заливки, с постоянным
 * 2px ring через box-shadow (outline, на фокусе/открытом меню — link_color), дающим "пространство"
 * вокруг значения, как у настоящего инпута. В tgui нет готового select-варианта такого поля, поэтому
 * "самописный". Кликабелен только бокс-триггер; subhead/subtitle — обычный текст вокруг (лейбл сверху,
 * подсказка снизу), как header/hint у Input.
 */
export function DropdownPicker<T extends string>({
  value,
  options,
  onChange,
  header,
  subtitle,
  placeholder = "Не выбрано",
  disabled,
  className,
  ariaLabel,
}: DropdownPickerProps<T>) {
  const { open, dir, maxHeight, rootRef, triggerRef, toggle, close } = useDropdownPosition();
  const isDisabled = disabled || options.length === 0;
  const current = options.find((o) => o.value === value);

  return (
    <div className={className ? `dropdown-picker ${className}` : "dropdown-picker"}>
      {header && <div className="dropdown-picker__subhead">{header}</div>}
      <div className="dropdown-picker__anchor" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className="dropdown-picker__trigger"
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={isDisabled}
        >
          <span className="dropdown-picker__value">{current?.label ?? placeholder}</span>
          <ChevronDown
            size={18}
            className="dropdown-picker__chevron"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          />
        </button>
        {open && (
          <ul
            className={`dropdown-picker__menu dropdown-picker__menu--${dir}`}
            role="listbox"
            style={{ maxHeight }}
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`dropdown-picker__option${o.value === value ? " is-active" : ""}`}
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
      {subtitle && <div className="dropdown-picker__subtitle">{subtitle}</div>}
    </div>
  );
}
