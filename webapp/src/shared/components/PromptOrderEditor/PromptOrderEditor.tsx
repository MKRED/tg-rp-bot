import { ActionIcon, Switch, Text } from "@mantine/core";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MOTION_TRANSITION } from "../../theme/motion";
import styles from "./PromptOrderEditor.module.css";

/** Элемент порядка: какой компонент запроса и включён ли он. Дженерик по набору id фичи. */
export interface PromptOrderEntry<Id extends string> {
  id: Id;
  enabled: boolean;
}

interface PromptOrderEditorProps<Id extends string> {
  order: PromptOrderEntry<Id>[];
  onChange: (order: PromptOrderEntry<Id>[]) => void;
  /** Подпись компонента. */
  labels: Record<Id, string>;
  /** Откуда берётся компонент — подпись-источник под названием. */
  sources: Record<Id, string>;
  /** Компоненты-заглушки (тумблер заблокирован, помечены «· скоро»). */
  unimplemented?: Id[];
}

/**
 * Редактор порядка и включённости компонентов запроса (RP- и narrator-шаблоны). Перестановка —
 * кнопками ↑/↓ (надёжно в Telegram webview, в отличие от drag-and-drop). Подписи/источники/заглушки
 * приходят пропсами — компонент не знает о наборе id.
 */
export function PromptOrderEditor<Id extends string>({
  order,
  onChange,
  labels,
  sources,
  unimplemented = [],
}: PromptOrderEditorProps<Id>) {
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const toggle = (index: number) => {
    onChange(order.map((it, i) => (i === index ? { ...it, enabled: !it.enabled } : it)));
  };

  return (
    <div>
      {order.map((item, index) => {
        const isUnimplemented = unimplemented.includes(item.id);
        const label = labels[item.id];
        return (
          // layout — при перестановке (key стабилен по item.id) строки плавно переезжают на новые
          // позиции (FLIP), а не перескакивают.
          <motion.div className={styles.row} key={item.id} layout transition={MOTION_TRANSITION}>
            <div className={styles.buttons}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xl"
                className={styles.arrow}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`${label}: выше`}
              >
                <ChevronUp size={20} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xl"
                className={styles.arrow}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`${label}: ниже`}
              >
                <ChevronDown size={20} />
              </ActionIcon>
            </div>
            <div className={item.enabled ? styles.text : `${styles.text} ${styles.muted}`}>
              <Text size="sm" fw={500}>
                {label}
                {isUnimplemented && (
                  <Text span size="xs" c="dimmed">
                    {" "}
                    · скоро
                  </Text>
                )}
              </Text>
              <Text size="xs" c="dimmed">
                {sources[item.id]}
              </Text>
            </div>
            <Switch
              checked={item.enabled}
              disabled={isUnimplemented}
              onChange={() => toggle(index)}
              aria-label={label}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
