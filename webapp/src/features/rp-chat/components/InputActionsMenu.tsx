import { Languages, Lightbulb, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface InputActionsMenuProps {
  onImpersonate: () => void;
  onTranslate: () => void;
  disabled: boolean;
}

/**
 * Левая кнопка инпута (видна при пустом поле). По нажатию раскрывает поповер с действиями над
 * полем: «Ответ от вашего лица» и «Перевод». Закрывается по выбору пункта или клику вне.
 */
export function InputActionsMenu({ onImpersonate, onTranslate, disabled }: InputActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне поповера.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="input-actions-menu" ref={rootRef}>
      {open && (
        <div className="input-actions-menu__popover" role="menu">
          <button
            className="input-actions-menu__item"
            onClick={() => pick(onImpersonate)}
            type="button"
            role="menuitem"
          >
            <Lightbulb size={18} />
            <span>Ответ от вашего лица</span>
          </button>
          <button
            className="input-actions-menu__item"
            onClick={() => pick(onTranslate)}
            type="button"
            role="menuitem"
          >
            <Languages size={18} />
            <span>Перевод</span>
          </button>
        </div>
      )}
      <button
        className="chat-input__impersonate"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        type="button"
        aria-label="Действия"
        aria-expanded={open}
      >
        <Plus
          size={24}
          style={{ transform: open ? "rotate(45deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
    </div>
  );
}
