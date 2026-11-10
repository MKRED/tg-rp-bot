import { ActionIcon, Menu, Text } from "@mantine/core";
import { ArrowLeft, EllipsisVertical } from "lucide-react";
import type { GalleryAction } from "./types";
import styles from "./ImageGallery.module.css";

interface GalleryHeaderProps {
  caption?: string;
  /** «2 из 5» — плашкой под шапкой; нет (одна картинка) — без плашки. */
  counter?: string;
  actions: GalleryAction[];
  /** Идёт действие (отправка в чат) — спиннер на «⋮». */
  busy: boolean;
  menuOpened: boolean;
  onMenuChange: (opened: boolean) => void;
  onClose: () => void;
}

/**
 * Шапка просмотра как в просмотре фото Telegram: «←» закрывает, подпись по левому краю, справа меню «⋮»;
 * под шапкой по центру — плашка «2 из 5».
 */
export function GalleryHeader({ caption, counter, actions, busy, menuOpened, onMenuChange, onClose }: GalleryHeaderProps) {
  return (
    <div className={styles.top}>
      <div className={styles.header}>
        <ActionIcon size={44} radius="xl" variant="subtle" color="gray.0" aria-label="Закрыть" onClick={onClose}>
          <ArrowLeft size={24} />
        </ActionIcon>
        <Text className={styles.caption} fw={600} c="white" truncate>
          {caption}
        </Text>
        {/* Без портала: выпадашка внутри галереи (z-index 9999), а не под ней. */}
        <Menu position="bottom-end" withinPortal={false} opened={menuOpened} onChange={onMenuChange}>
          <Menu.Target>
            <ActionIcon size={44} radius="xl" variant="subtle" color="gray.0" aria-label="Действия с картинкой" loading={busy}>
              <EllipsisVertical size={22} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {actions.map((a) => (
              <Menu.Item key={a.key} leftSection={a.icon} disabled={a.disabled} onClick={a.onClick}>
                {a.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>
      {counter && <div className={styles.counter}>{counter}</div>}
    </div>
  );
}
