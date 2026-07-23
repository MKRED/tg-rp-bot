import { Button } from "@telegram-apps/telegram-ui";
import type { ReactNode } from "react";
import "./DeleteButton.css";

interface DeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Растянутая кнопка деструктивного действия («Удалить …») для подвала форм. У tg-ui Button
 * нет деструктивного mode (он есть только у ButtonCell — другой, не pill-стиль), поэтому красим
 * outline-кнопку своим CSS-классом.
 */
export function DeleteButton({ onClick, disabled, children }: DeleteButtonProps) {
  return (
    <Button size="l" stretched mode="outline" className="delete-button" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
