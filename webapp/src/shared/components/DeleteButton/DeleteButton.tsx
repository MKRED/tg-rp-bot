import { Button } from "@telegram-apps/telegram-ui";
import type { ReactNode } from "react";

interface DeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Растянутая кнопка деструктивного действия («Удалить …») для подвала форм. Красный цвет —
 * класс .delete-button из глобального index.css (см. комментарий там же про причину).
 */
export function DeleteButton({ onClick, disabled, children }: DeleteButtonProps) {
  return (
    <Button size="l" stretched mode="outline" className="delete-button" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
