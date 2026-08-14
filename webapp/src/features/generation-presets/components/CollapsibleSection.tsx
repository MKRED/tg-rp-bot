import { Subheadline } from "@telegram-apps/telegram-ui";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  /** Открыта ли группа по умолчанию (по умолчанию свёрнута). */
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Сворачивающаяся группа настроек: заголовок-кнопка с шевроном раскрывает/прячет содержимое. */
export function CollapsibleSection({ title, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`preset-collapse${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="preset-collapse__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Subheadline level="1" weight="2" Component="span" className="preset-collapse__title">{title}</Subheadline>
        <ChevronDown
          size={18}
          className="preset-collapse__chevron"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {/* Раскрытие через grid-template-rows 0fr→1fr — анимирует высоту без замера JS;
          содержимое не размонтируется, поэтому состояние полей формы сохраняется. */}
      <div className="preset-collapse__panel">
        <div className="preset-collapse__body">{children}</div>
      </div>
    </div>
  );
}
