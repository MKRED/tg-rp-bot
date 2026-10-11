import { Badge, Group, Text, UnstyledButton } from "@mantine/core";
import { motion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { MOTION_TRANSITION } from "../../theme/motion";
import styles from "./NavList.module.css";

/** Шаг между появлением соседних строк, с. */
const STAGGER_S = 0.04;
/** Дальше этой строки задержка не растёт — длинное меню не «досыпается» по полсекунды. */
const STAGGER_MAX_INDEX = 10;

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick?: () => void;
  /** Пункт ещё не готов: неактивен, справа бейдж «Скоро». */
  soon?: boolean;
  /**
   * Порядковый номер строки на экране — задержка появления. Сквозной по всем группам, чтобы строки
   * выезжали одна за другой сверху вниз, а не все группы разом.
   */
  index?: number;
}

/** Строка навигации: иконка, название, подпись, шеврон. Целиком кликабельна, высота — не меньше 44px. */
export function NavItem({ icon: Icon, label, description, onClick, soon, index = 0 }: NavItemProps) {
  return (
    <motion.div
      className={styles.row}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_TRANSITION, delay: Math.min(index, STAGGER_MAX_INDEX) * STAGGER_S }}
    >
      {/* aria-disabled, а не disabled: пункт остаётся в порядке фокуса и скринридер озвучит «Скоро». */}
      <UnstyledButton className={styles.item} onClick={soon ? undefined : onClick} aria-disabled={soon || undefined}>
        <Group wrap="nowrap" gap="md">
          <Icon size={24} className={soon ? styles.iconMuted : styles.icon} aria-hidden />
          <div className={soon ? `${styles.text} ${styles.muted}` : styles.text}>
            <Text fw={500}>{label}</Text>
            {description && (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            )}
          </div>
          {soon ? (
            <Badge variant="light" color="gray">
              Скоро
            </Badge>
          ) : (
            <ChevronRight size={18} className={styles.chevron} />
          )}
        </Group>
      </UnstyledButton>
    </motion.div>
  );
}
