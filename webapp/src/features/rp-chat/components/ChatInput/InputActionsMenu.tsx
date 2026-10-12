import { ActionIcon, Menu } from "@mantine/core";
import { Languages, Lightbulb, Plus } from "lucide-react";
import { useState } from "react";
import styles from "./ChatInput.module.css";

interface InputActionsMenuProps {
  onImpersonate: () => void;
  onTranslate: () => void;
  disabled: boolean;
}

/** Кнопка «+» слева от пустого поля: меню «Ответ от вашего лица» и «Перевод». */
export function InputActionsMenu({ onImpersonate, onTranslate, disabled }: InputActionsMenuProps) {
  const [opened, setOpened] = useState(false);

  return (
    <Menu opened={opened} onChange={setOpened} position="top-start" offset={8} width={240}>
      <Menu.Target>
        <ActionIcon
          variant="light"
          size={44}
          radius="xl"
          disabled={disabled}
          className={styles.plus}
          data-opened={opened || undefined}
          aria-label="Действия"
        >
          <Plus size={22} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<Lightbulb size={18} />} onClick={onImpersonate}>
          Ответ от вашего лица
        </Menu.Item>
        <Menu.Item leftSection={<Languages size={18} />} onClick={onTranslate}>
          Перевод
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
