import { Loader, Menu, UnstyledButton } from "@mantine/core";
import { Reorder } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { suspendVerticalSwipes } from "../../../../shared/telegram/verticalSwipes";
import styles from "./CanvasWorkspace.module.css";

interface ReferenceTileProps {
  /** Значение для Reorder — прежний слот картинки, стабилен на время перетаскивания. */
  value: number;
  /** Текущее место плитки — номер на ней и N в `<imageN>`. */
  position: number;
  count: number;
  thumb: string;
  preparing: boolean;
  busy: boolean;
  menuOpened: boolean;
  onMenuChange: (opened: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onView: () => void;
  onReplace: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * Прикреплённая картинка: тап — меню, протяжка влево-вправо — перестановка. «Левее / Правее» в меню —
 * не дубль: плитка на телефоне 44 px, и протяжкой легко промахнуться.
 */
export function ReferenceTile({
  value,
  position,
  count,
  thumb,
  preparing,
  busy,
  menuOpened,
  onMenuChange,
  onDragStart,
  onDragEnd,
  onView,
  onReplace,
  onMove,
  onRemove,
}: ReferenceTileProps) {
  return (
    <Reorder.Item
      as="div"
      value={value}
      dragListener={!busy}
      className={styles.refItem}
      onPointerDown={() => {
        if (busy) return;
        // Протяжка с лёгким уходом вниз не должна сворачивать Mini App.
        const restoreSwipes = suspendVerticalSwipes();
        window.addEventListener("pointerup", restoreSwipes, { once: true });
        window.addEventListener("pointercancel", restoreSwipes, { once: true });
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Menu position="top-start" withinPortal opened={menuOpened} onChange={onMenuChange}>
        <Menu.Target>
          <UnstyledButton className={styles.refTile} aria-label={`Картинка ${position + 1}`} disabled={busy}>
            {preparing ? <Loader size="xs" /> : <img src={thumb} alt="" draggable={false} />}
            <span className={styles.refTag}>{position + 1}</span>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={onView}>Посмотреть</Menu.Item>
          <Menu.Item onClick={onReplace}>Заменить</Menu.Item>
          {count > 1 && (
            <>
              <Menu.Item leftSection={<ChevronLeft size={16} />} disabled={position === 0} onClick={() => onMove(-1)}>
                Левее
              </Menu.Item>
              <Menu.Item leftSection={<ChevronRight size={16} />} disabled={position === count - 1} onClick={() => onMove(1)}>
                Правее
              </Menu.Item>
            </>
          )}
          <Menu.Item color="red" onClick={onRemove}>
            Убрать
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Reorder.Item>
  );
}
