import { Button, Cell, Input, List, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebugLlm } from "../hooks/useDebugLlm";
import { DebugRecordItem } from "./DebugRecordItem";
import "./debug.css";

/**
 * Экран отладки LLM: перехваченные RAW-запросы текущего пользователя + управление перехватом
 * (тумблер «писать лог», N последних запросов) и показом (сколько сообщений с краёв).
 */
export function DebugLlmView() {
  const {
    settings,
    records,
    loading,
    headK,
    tailK,
    setHeadK,
    setTailK,
    refresh,
    updateSettings,
    clear,
  } = useDebugLlm();

  return (
    <div className="debug-llm">
      <List>
        <Section header="Перехват" footer="Лог хранится в памяти сервера и сбрасывается при перезапуске.">
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
        </Section>

        <Section header="Показ" footer="Усечение длинного messages[] — только в этом экране, на сам запрос не влияет.">
          <NumberRow
            label="Сообщений с начала"
            value={headK}
            min={0}
            onCommit={setHeadK}
          />
          <NumberRow
            label="Сообщений с конца"
            value={tailK}
            min={0}
            onCommit={setTailK}
          />
        </Section>

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
            <div className="debug-llm__empty">Пока нет запросов</div>
          ) : (
            records.map((rec) => (
              <DebugRecordItem key={rec.id} record={rec} headK={headK} tailK={tailK} />
            ))
          )}
        </Section>
      </List>
    </div>
  );
}

/**
 * Числовое поле с коммитом на blur (а не на каждое нажатие): иначе правка N дёргала бы API,
 * а правка K — переразбор JSON на каждый символ. Пустой/некорректный ввод откатывается.
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

  return (
    <Cell
      subtitle={subtitle}
      after={
        <Input
          type="number"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // Коммит по Enter (на blur тоже коммитим — но Enter ожидаем явно).
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          style={{ width: 88, textAlign: "right" }}
        />
      }
    >
      {label}
    </Cell>
  );
}
