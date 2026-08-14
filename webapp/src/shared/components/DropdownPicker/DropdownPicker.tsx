import { Spinner, Subheadline } from "@telegram-apps/telegram-ui";
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
  /** Зовётся при каждом раскрытии меню — например, чтобы подтянуть свежий список опций. */
  onOpen?: () => void;
  /** Идёт фоновая загрузка опций (см. onOpen): вместо шеврона — спиннер, вместо списка — заглушка. */
  pending?: boolean;
}

/**
 * Full-width выпадающий список вместо нативного <select> — Telegram webview на ПК (Chromium)
 * рисует нативный попап системно-белым, светлый текст на нём не виден. Раскрывается вверх или вниз
 * по реальному месту вокруг триггера (useDropdownPosition), поэтому не растягивает страницу, если
 * триггер оказался у нижнего края экрана. Компактный pill-вариант с другим anchor'ом — отдельный
 * LangPicker (штора перевода), сюда не сведён из-за другого визуального контракта.
 *
 * Текст — типографика tgui (`Subheadline`), а сам триггер оформлен как поле `Input`/`FormInput`
 * на базовой платформе — без заливки, с постоянным 2px ring через box-shadow (outline, на
 * фокусе/открытом меню — link_color), дающим "пространство" вокруг значения, как у настоящего
 * инпута. В tgui нет готового select-варианта такого поля, поэтому "самописный". Кликабелен
 * только бокс-триггер; header/subtitle — обычный текст вокруг (лейбл сверху, подсказка снизу),
 * как header/hint у Input.
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
  onOpen,
  pending,
}: DropdownPickerProps<T>) {
  const { open, dir, maxHeight, rootRef, triggerRef, toggle, close } = useDropdownPosition();
  // Без onOpen пустой список действительно нечего открывать; с ним открытие — единственный способ
  // его наполнить, поэтому пустота опций до первой загрузки триггер не блокирует.
  const isDisabled = disabled || (options.length === 0 && !onOpen);
  const current = options.find((o) => o.value === value);

  const handleToggle = () => {
    if (!open) onOpen?.();
    toggle();
  };

  return (
    <div className={className ? `dropdown-picker ${className}` : "dropdown-picker"}>
      {header && (
        <Subheadline level="1" Component="div" className="dropdown-picker__header">
          {header}
        </Subheadline>
      )}
      <div className="dropdown-picker__anchor" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className="dropdown-picker__trigger"
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={isDisabled}
        >
          <Subheadline level="1" Component="span" className="dropdown-picker__value">
            {current?.label ?? placeholder}
          </Subheadline>
          {pending ? (
            <Spinner size="s" className="dropdown-picker__spinner" />
          ) : (
            <ChevronDown
              size={18}
              className="dropdown-picker__chevron"
              style={{ transform: open ? "rotate(180deg)" : "none" }}
            />
          )}
        </button>
        {open && (
          <ul
            className={`dropdown-picker__menu dropdown-picker__menu--${dir}`}
            role="listbox"
            style={{ maxHeight }}
          >
            {pending ? (
              <Subheadline level="2" Component="li" className="dropdown-picker__status">
                Загрузка…
              </Subheadline>
            ) : (
              options.map((o) => (
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
                    <Subheadline level="2" weight={o.value === value ? "2" : "3"} Component="span">
                      {o.label}
                    </Subheadline>
                    {o.value === value && <Check size={16} />}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {subtitle && (
        <Subheadline level="2" Component="div" className="dropdown-picker__subtitle">
          {subtitle}
        </Subheadline>
      )}
    </div>
  );
}
