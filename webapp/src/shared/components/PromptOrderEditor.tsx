import { Switch } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import "./PromptOrderEditor.css";

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
 * Редактор порядка и включённости компонентов запроса (кросс-фичевый: настройки ответа ИИ и
 * narrator-шаблоны). Перестановка — кнопками ↑/↓ (надёжно в Telegram webview, в отличие от
 * drag-and-drop). Подписи/источники/заглушки приходят пропсами — компонент не знает о наборе id.
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
    <div className="prompt-order">
      {order.map((item, index) => {
        const isUnimplemented = unimplemented.includes(item.id);
        return (
          // layout — при перестановке (key стабилен по item.id) строки плавно переезжают на новые
          // позиции (FLIP), а не перескакивают. Так же реагируют на смену высоты соседей.
          <motion.div
            className="prompt-order__row"
            key={item.id}
            layout
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="prompt-order__buttons">
              <button
                type="button"
                className="prompt-order__btn"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="Выше"
              >
                ↑
              </button>
              <button
                type="button"
                className="prompt-order__btn"
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Ниже"
              >
                ↓
              </button>
            </div>
            <div className="prompt-order__text">
              <span className="prompt-order__label">
                {labels[item.id]}
                {isUnimplemented && <span className="prompt-order__soon"> · скоро</span>}
              </span>
              <span className="prompt-order__source">{sources[item.id]}</span>
            </div>
            <Switch
              checked={item.enabled}
              disabled={isUnimplemented}
              onChange={() => toggle(index)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
