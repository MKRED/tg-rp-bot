import { Button } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./DeleteButton.module.css";

interface DeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

/** Растянутая кнопка деструктивного действия («Удалить …») для подвала форм. */
export function DeleteButton({ onClick, disabled, children }: DeleteButtonProps) {
  return (
    <Button fullWidth variant="subtle" color="red" className={styles.danger} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
