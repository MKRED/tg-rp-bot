import { Button, Cell, List, Section, Spinner, Switch, Text } from "@telegram-apps/telegram-ui";
import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionWithFooter } from "../../../shared/components/SectionWithFooter";
import { useDebugLlm } from "../hooks/useDebugLlm";
import { DebugRecordItem } from "./DebugRecordItem";
import "./debug.css";

/**
 * Экран отладки LLM: перехваченные RAW-запросы текущего пользователя + управление перехватом
 * (тумблер «писать лог», N последних запросов) и показом (сколько сообщений с краёв).
 */
export function DebugLlmView() {
  const { settings, records, loading, refresh, updateSettings, clear } = useDebugLlm();

  return (
    <div className="debug-llm">
      <List>
        <SectionWithFooter
          header="Перехват"
          footer="Лог хранится в памяти сервера и сбрасывается при перезапуске."
        >
          <Cell
            after={
              <Switch
                checked={settings.enabled}
                onChange={(e) => updateSettings({ enabled: e.target.checked })}
              />
            }
            subtitle="Записывать запросы к ИИ"
          >
            Писать лог
          </Cell>
          <NumberRow
            label="Хранить запросов"
            subtitle="Сколько последних держать"
            value={settings.maxRequests}
            min={1}
            onCommit={(n) => updateSettings({ maxRequests: n })}
          />
        </SectionWithFooter>

        <SectionWithFooter
          header="Показ"
          footer="Усечение длинного messages[] — только на показе, на сам запрос не влияет. Хранится на сервере, одинаково на всех устройствах."
        >
          <NumberRow
            label="Сообщений с начала"
            value={settings.headMessages}
            min={0}
            onCommit={(n) => updateSettings({ headMessages: n })}
          />
          <NumberRow
            label="Сообщений с конца"
            value={settings.tailMessages}
            min={0}
            onCommit={(n) => updateSettings({ tailMessages: n })}
          />
        </SectionWithFooter>

        <Section header={`Запросы (${records.length})`}>
          <div className="debug-llm__actions">
            <Button size="s" mode="bezeled" before={<RefreshCw size={16} />} onClick={() => void refresh()}>
              Обновить
            </Button>
            <Button
              size="s"
              mode="bezeled"
              before={<Trash2 size={16} />}
              disabled={records.length === 0}
              onClick={() => void clear()}
            >
              Очистить
            </Button>
          </div>

          {loading ? (
            <div className="debug-llm__center">
              <Spinner size="m" />
            </div>
          ) : records.length === 0 ? (
            <Text Component="div" className="debug-llm__empty">Пока нет запросов</Text>
          ) : (
            records.map((rec) => (
              <DebugRecordItem
                key={rec.id}
                record={rec}
                headK={settings.headMessages}
                tailK={settings.tailMessages}
              />
            ))
          )}
        </Section>
      </List>
    </div>
  );
}

/**
 * Числовая настройка компактным степпером (−  N  +) в правой части ячейки. Кнопки ±1
 * меняют и сразу коммитят; ручной ввод коммитится на blur/Enter (а не на каждый символ —
 * иначе правка дёргала бы API). Пустой/некорректный ввод откатывается к валидному.
 */
function NumberRow({
  label,
  subtitle,
  value,
  min,
  onCommit,
}: {
  label: string;
  subtitle?: string;
  value: number;
  min: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n >= min) onCommit(Math.floor(n));
    else setText(String(value)); // откат к валидному
  };

  const step = (delta: number) => {
    const base = Number.isFinite(Number(text)) ? Math.floor(Number(text)) : value;
    const next = Math.max(min, base + delta);
    setText(String(next));
    onCommit(next);
  };

  return (
    <Cell
      subtitle={subtitle}
      after={
        <div className="debug-stepper">
          <button
            type="button"
            className="debug-stepper__btn"
            aria-label="Уменьшить"
            disabled={Number(text) <= min}
            onClick={() => step(-1)}
          >
            −
          </button>
          <input
            className="debug-stepper__input"
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              // Коммит по Enter (на blur тоже коммитим — но Enter ожидаем явно).
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <button
            type="button"
            className="debug-stepper__btn"
            aria-label="Увеличить"
            onClick={() => step(1)}
          >
            +
          </button>
        </div>
      }
    >
      {label}
    </Cell>
  );
}
