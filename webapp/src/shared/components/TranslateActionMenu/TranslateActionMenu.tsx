import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import "./TranslateActionMenu.css";

interface TranslateActionMenuProps {
  onRegenerate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Мини-меню действий над закэшированным переводом сообщения — открывается долгим нажатием/ПКМ
 * на кнопке перевода (Globe). Абсолютно позиционируется относительно обёртки вызывающей кнопки
 * (та должна иметь position: relative).
 */
export function TranslateActionMenu({ onRegenerate, onDelete, onClose }: TranslateActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="translate-action-menu" role="menu">
      <button
        type="button"
        role="menuitem"
        className="translate-action-menu__item"
        onClick={() => {
          onRegenerate();
          onClose();
        }}
      >
        <RefreshCw size={15} />
        Перевести заново
      </button>
      <button
        type="button"
        role="menuitem"
        className="translate-action-menu__item translate-action-menu__item--danger"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 size={15} />
        Удалить перевод
      </button>
    </div>
  );
}
