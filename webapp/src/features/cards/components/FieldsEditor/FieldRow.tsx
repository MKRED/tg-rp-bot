import { ActionIcon, Button, Group, Switch, Text, TextInput, UnstyledButton } from "@mantine/core";
import type { CardField } from "@tg-rp-bot/shared";
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import type { PointerEvent } from "react";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { suspendVerticalSwipes } from "../../../../shared/telegram/verticalSwipes";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import styles from "./FieldsEditor.module.css";

interface FieldRowProps<T extends CardField> {
  field: T;
  index: number;
  count: number;
  open: boolean;
  /** Поле только что добавлено — фокус сразу в название, чтобы не искать его глазами. */
  autoFocus?: boolean;
  onToggle: () => void;
  onChange: (next: T) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/** Подпись под названием: первая строка примера формата или что поле выключено. */
function subtitle(field: CardField): string {
  if (!field.enabled) return "выключено — не генерируется";
  return field.description.split("\n").find((line) => line.trim() !== "")?.trim() ?? "Пример формата не задан";
}

/**
 * Одно поле: компактная строка (ручка перетаскивания, номер, название, тумблер), по нажатию —
 * раскрывается на месте: название, пример формата, ↑/↓ и удаление. ↑/↓ — не дубль перетаскивания:
 * Reorder не прокручивает страницу во время протяжки, и в длинном списке это единственный путь.
 */
export function FieldRow<T extends CardField>({
  field,
  index,
  count,
  open,
  autoFocus,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: FieldRowProps<T>) {
  const controls = useDragControls();
  const name = field.title || "Без названия";

  // Тянуть можно только за ручку (dragListener={false}), чтобы касание строки оставалось прокруткой.
  const startDrag = (e: PointerEvent) => {
    const restoreSwipes = suspendVerticalSwipes();
    window.addEventListener("pointerup", restoreSwipes, { once: true });
    window.addEventListener("pointercancel", restoreSwipes, { once: true });
    controls.start(e);
  };

  return (
    <Reorder.Item as="div" value={field.id} dragListener={false} dragControls={controls} className={styles.item}>
      <div className={styles.row}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="xl"
          className={styles.grip}
          aria-label={`Перетащить «${name}»`}
          onPointerDown={startDrag}
        >
          <GripVertical size={18} />
        </ActionIcon>
        <UnstyledButton className={styles.main} aria-expanded={open} onClick={onToggle}>
          <Text size="xs" c="dimmed" className={styles.num}>
            {index + 1}
          </Text>
          <div className={styles.text}>
            <Text fw={600} truncate c={field.enabled ? undefined : "dimmed"}>
              {name}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {subtitle(field)}
            </Text>
          </div>
        </UnstyledButton>
        <Switch
          aria-label={`${name}: включено`}
          checked={field.enabled}
          onChange={(e) => onChange({ ...field, enabled: e.currentTarget.checked })}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.panelWrap}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={MOTION_TRANSITION}
          >
            <div className={styles.panel}>
              <TextInput
                label="Название"
                placeholder="Название поля"
                autoFocus={autoFocus}
                value={field.title}
                onChange={(e) => onChange({ ...field, title: e.currentTarget.value })}
              />
              <PromptEditorField
                header="Пример формата"
                hint="Что должен сгенерировать ИИ для этого поля — задаёт формат и объём ответа."
                placeholder="Пример формата для этого поля…"
                value={field.description}
                previewLines={3}
                onChange={(value) => onChange({ ...field, description: value })}
              />
              <Group gap="xs" wrap="nowrap">
                <ActionIcon
                  variant="default"
                  size="xl"
                  aria-label={`${name}: выше`}
                  disabled={index === 0}
                  onClick={() => onMove(-1)}
                >
                  <ChevronUp size={20} />
                </ActionIcon>
                <ActionIcon
                  variant="default"
                  size="xl"
                  aria-label={`${name}: ниже`}
                  disabled={index === count - 1}
                  onClick={() => onMove(1)}
                >
                  <ChevronDown size={20} />
                </ActionIcon>
                <Button variant="subtle" color="red" ml="auto" leftSection={<Trash2 size={16} />} onClick={onRemove}>
                  Удалить поле
                </Button>
              </Group>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}
