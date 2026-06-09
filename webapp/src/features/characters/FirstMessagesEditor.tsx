import { Button, Textarea } from "@telegram-apps/telegram-ui";
import { estimateTokens } from "./tokens";
import { MAX_FIRST_MESSAGES } from "./types";

interface FirstMessagesEditorProps {
  messages: string[];
  onChange: (messages: string[]) => void;
}

/**
 * Редактор вариантов первого сообщения: список Textarea с добавлением/удалением и счётчиком
 * токенов у каждого. При старте нового чата бот возьмёт один из вариантов. Кнопка «добавить»
 * блокируется на лимите (MAX_FIRST_MESSAGES) — серверная проверка дублирует его.
 */
export function FirstMessagesEditor({ messages, onChange }: FirstMessagesEditorProps) {
  // Всегда показываем хотя бы одно поле, даже если массив пуст (режим создания).
  const items = messages.length > 0 ? messages : [""];

  const updateAt = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  const add = () => {
    if (items.length >= MAX_FIRST_MESSAGES) return;
    onChange([...items, ""]);
  };

  return (
    <div className="char-firsts">
      {items.map((msg, index) => (
        // index как key оправдан: порядок стабилен, удаление пересобирает значения из состояния
        <div className="char-firsts__item" key={index}>
          <Textarea
            header={`Вариант ${index + 1}`}
            placeholder="Первое сообщение персонажа в новом чате…"
            value={msg}
            rows={3}
            onChange={(e) => updateAt(index, e.target.value)}
          />
          <div className="char-field__meta">
            <span className="char-field__tokens">~{estimateTokens(msg)} токенов</span>
            {items.length > 1 && (
              <button
                type="button"
                className="char-firsts__remove"
                onClick={() => removeAt(index)}
              >
                Удалить вариант
              </button>
            )}
          </div>
        </div>
      ))}
      <Button
        size="s"
        mode="outline"
        disabled={items.length >= MAX_FIRST_MESSAGES}
        onClick={add}
      >
        + Добавить вариант
      </Button>
    </div>
  );
}
