import { Text, UnstyledButton } from "@mantine/core";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { MOTION_TRANSITION } from "../../theme/motion";
import styles from "./ListCard.module.css";

/** Шаг между появлением соседних строк, с. */
const STAGGER_S = 0.04;
/** Дальше этой строки задержка не растёт — длинный список не «досыпается» по полсекунды. */
const STAGGER_MAX_INDEX = 10;

interface ListRowProps {
  /** Слева: иконка или аватар. Может содержать свою кнопку (аватар → лайтбокс) — она перехватит тап. */
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Справа перед шевроном: дата, бейдж. */
  meta?: ReactNode;
  /**
   * Справа, вне кнопки строки: свои кнопки (↑/↓ порядка). Внутрь кнопки строки их класть нельзя —
   * кнопка в кнопке. Шеврон при trailing не рисуется: справа и так есть элементы управления.
   */
  trailing?: ReactNode;
  /** FLIP-анимация при перестановке строк (нужен стабильный key). */
  layout?: boolean;
  /** Шеврон «перейти» справа. false — строка выбора в списке, а не переход на экран. */
  chevron?: boolean;
  onClick?: () => void;
  /** Неактивна: приглушена, без шеврона, тап ничего не делает. */
  disabled?: boolean;
  /**
   * Порядковый номер строки на экране — задержка появления. Сквозной по всем группам, чтобы строки
   * выезжали одна за другой сверху вниз, а не все группы разом.
   */
  index?: number;
}

/**
 * Строка списка: слева иконка/аватар, название, подпись, справа мета и шеврон. Тап по любой точке
 * строки — onClick, высота не меньше 44px.
 *
 * Кнопка строки — не обёртка всей строки, а сосед `leading`/`trailing`: иначе кнопка аватара или стрелки
 * оказались бы внутри кнопки (невалидный HTML). Зону нажатия на всю строку даёт псевдоэлемент кнопки
 * (см. .main в CSS).
 */
export function ListRow({
  leading,
  title,
  description,
  meta,
  trailing,
  layout,
  chevron = true,
  onClick,
  disabled,
  index = 0,
}: ListRowProps) {
  return (
    <motion.div
      className={styles.row}
      data-disabled={disabled || undefined}
      layout={layout}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...MOTION_TRANSITION,
        delay: Math.min(index, STAGGER_MAX_INDEX) * STAGGER_S,
        // Перестановка — без задержки появления, иначе нижние строки переезжали бы с опозданием.
        layout: MOTION_TRANSITION,
      }}
    >
      {leading && <div className={styles.leading}>{leading}</div>}
      {/* aria-disabled, а не disabled: строка остаётся в порядке фокуса, скринридер озвучит причину (бейдж). */}
      <UnstyledButton
        className={styles.main}
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled || undefined}
      >
        <div className={styles.text}>
          <Text fw={500} truncate>
            {title}
          </Text>
          {description && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {description}
            </Text>
          )}
        </div>
        {meta}
        {chevron && !disabled && !trailing && <ChevronRight size={18} className={styles.chevron} aria-hidden />}
      </UnstyledButton>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </motion.div>
  );
}
