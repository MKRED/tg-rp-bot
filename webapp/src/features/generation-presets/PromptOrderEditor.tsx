import { Switch } from "@telegram-apps/telegram-ui";
import {
  PROMPT_COMPONENT_LABELS,
  UNIMPLEMENTED_COMPONENTS,
  type PromptOrderItem,
} from "./types";

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
          <div className="preset-order__row" key={item.id}>
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
            <span className="preset-order__label">
              {PROMPT_COMPONENT_LABELS[item.id]}
              {unimplemented && <span className="preset-order__soon"> · скоро</span>}
            </span>
            <Switch
              checked={item.enabled}
              disabled={unimplemented}
              onChange={() => toggle(index)}
            />
          </div>
        );
      })}
    </div>
  );
}
