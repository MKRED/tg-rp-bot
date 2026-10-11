import { Button } from "@mantine/core";
import type { ReactNode } from "react";

interface DeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

/** Растянутая кнопка деструктивного действия («Удалить …») для подвала форм. */
export function DeleteButton({ onClick, disabled, children }: DeleteButtonProps) {
  return (
    <Button fullWidth variant="subtle" color="red" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
