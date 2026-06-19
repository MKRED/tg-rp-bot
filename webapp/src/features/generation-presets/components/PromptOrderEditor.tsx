import { Switch } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import {
  PROMPT_COMPONENT_LABELS,
  PROMPT_COMPONENT_SOURCES,
  UNIMPLEMENTED_COMPONENTS,
  type PromptOrderItem,
} from "../types/preset";

interface PromptOrderEditorProps {
  order: PromptOrderItem[];
  onChange: (order: PromptOrderItem[]) => void;
}

/**
 * Редактор порядка и включённости компонентов запроса. Перестановка — кнопками ↑/↓
 * (надёжно в Telegram webview, в отличие от drag-and-drop). Компоненты из
 * UNIMPLEMENTED_COMPONENTS показываются неактивными (тумблер заблокирован) — задел на будущее.
 */
export function PromptOrderEditor({ order, onChange }: PromptOrderEditorProps) {
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
    <div className="preset-order">
      {order.map((item, index) => {
        const unimplemented = UNIMPLEMENTED_COMPONENTS.includes(item.id);
        return (
          // layout — при перестановке (key стабилен по item.id) строки плавно переезжают на новые
          // позиции (FLIP), а не перескакивают. Так же реагируют на смену высоты соседей.
          <motion.div
            className="preset-order__row"
            key={item.id}
            layout
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="preset-order__buttons">
              <button
                type="button"
                className="preset-order__btn"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="Выше"
              >
                ↑
              </button>
              <button
                type="button"
                className="preset-order__btn"
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Ниже"
              >
                ↓
              </button>
            </div>
            <div className="preset-order__text">
              <span className="preset-order__label">
                {PROMPT_COMPONENT_LABELS[item.id]}
                {unimplemented && <span className="preset-order__soon"> · скоро</span>}
              </span>
              <span className="preset-order__source">{PROMPT_COMPONENT_SOURCES[item.id]}</span>
            </div>
            <Switch
              checked={item.enabled}
              disabled={unimplemented}
              onChange={() => toggle(index)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
