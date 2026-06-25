import { Cell } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

interface Option<T extends string> {
  value: T;
  label: string;
}

interface ExpandableSelectProps<T extends string> {
  /** Заголовок ячейки-триггера (напр. «Язык»). */
  title: string;
  /** Подпись под заголовком. */
  subtitle: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Открыт ли список. Состояние держит родитель — чтобы открытие одного закрывало остальные. */
  open: boolean;
  onToggle: () => void;
  /** Задержка анимации появления ячейки-триггера. */
  delay?: number;
}

/**
 * Раскрывающийся одиночный селект: ячейка-триггер + анимированный список опций с галочкой.
 * Кросс-фичевый (настройки перевода RP-чата и narrator-истории) — потому в shared/components.
 */
export function ExpandableSelect<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
  open,
  onToggle,
  delay = 0,
}: ExpandableSelectProps<T>) {
  const currentLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...ITEM_T, delay }}
      >
        <Cell
          onClick={onToggle}
          after={
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--tg-theme-hint-color)" }}>
              <span style={{ fontSize: 14 }}>{currentLabel}</span>
              <ChevronDown
                size={16}
                style={{
                  transition: "transform 0.2s",
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          }
          subtitle={subtitle}
        >
          {title}
        </Cell>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={ITEM_T}
            style={{ overflow: "hidden" }}
          >
            {options.map((o) => (
              <Cell
                key={o.value}
                onClick={() => onChange(o.value)}
                after={value === o.value ? <Check size={16} /> : null}
                style={{ paddingLeft: 32 }}
              >
                {o.label}
              </Cell>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
