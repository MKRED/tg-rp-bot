import { Drawer, Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { ReactNode } from "react";
import styles from "./ResponsiveSheet.module.css";

interface ResponsiveSheetProps {
  opened: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

// Брейкпоинт sm Mantine (48em) — граница «телефон / широкий экран», как в CSS-модулях.
const WIDE_QUERY = "(min-width: 48em)";

/**
 * Выбор и действия поверх экрана: на телефоне — шторка снизу (до неё дотягивается палец), на широком
 * экране — окно по центру, чтобы не растягивать шторку на весь монитор.
 */
export function ResponsiveSheet({ opened, onClose, title, children }: ResponsiveSheetProps) {
  // getInitialValueInEffect: false — на первом же рендере верный вариант, без мигания Drawer → Modal.
  const wide = useMediaQuery(WIDE_QUERY, false, { getInitialValueInEffect: false });

  if (wide) {
    return (
      <Modal opened={opened} onClose={onClose} title={title} centered>
        {children}
      </Modal>
    );
  }
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={title}
      position="bottom"
      size="auto"
      classNames={{ body: styles.drawerBody, content: styles.drawerContent }}
    >
      {children}
    </Drawer>
  );
}
