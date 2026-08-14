import { Button, Caption } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ExpandableTextarea } from "../../../shared/components/ExpandableTextarea";
import { estimateTokens } from "../../../shared/text/tokens";
import { MAX_FIRST_MESSAGES } from "../types/character";

interface FirstMessagesEditorProps {
  messages: string[];
  onChange: (messages: string[]) => void;
}

/**
 * Редактор вариантов первого сообщения: список Textarea с добавлением/удалением и счётчиком
 * токенов у каждого. При старте нового чата бот возьмёт один из вариантов. Кнопка «добавить»
 * блокируется на лимите (MAX_FIRST_MESSAGES) — серверная проверка дублирует его.
 *
 * Появление/удаление вариантов анимируем через framer-motion (height + opacity). Для корректной
 * exit-анимации нужен СТАБИЛЬНЫЙ key: индекс не годится (при удалении из середины индексы
 * съезжают и AnimatePresence анимирует не тот элемент). Поэтому держим параллельный массив
 * стабильных id, выровненный по позициям с messages, и правим его в тех же мутациях.
 */
export function FirstMessagesEditor({ messages, onChange }: FirstMessagesEditorProps) {
  // Всегда показываем хотя бы одно поле, даже если массив пуст (режим создания).
  const items = messages.length > 0 ? messages : [""];

  const idCounter = useRef(0);
  const [ids, setIds] = useState<number[]>(() => items.map(() => idCounter.current++));

  // Подстраховка на случай внешней смены длины messages (напр. подгрузка initial):
  // добиваем/обрезаем id с конца. Наши собственные мутации ниже уже держат длины в синхроне,
  // так что здесь обычно no-op.
  useEffect(() => {
    setIds((prev) => {
      if (prev.length === items.length) return prev;
      if (prev.length < items.length) {
        const extra = Array.from({ length: items.length - prev.length }, () => idCounter.current++);
        return [...prev, ...extra];
      }
      return prev.slice(0, items.length);
    });
  }, [items.length]);

  const updateAt = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number) => {
    setIds((prev) => prev.filter((_, i) => i !== index));
    onChange(items.filter((_, i) => i !== index));
  };

  const add = () => {
    if (items.length >= MAX_FIRST_MESSAGES) return;
    setIds((prev) => [...prev, idCounter.current++]);
    onChange([...items, ""]);
  };

  return (
    <div className="char-firsts">
      <AnimatePresence initial={false}>
        {items.map((msg, index) => (
          <motion.div
            className="char-firsts__item"
            // фолбэк на индекс — на один кадр рассинхрона ids/items (внешняя смена длины),
            // чтобы не словить key=undefined; в норме ids поддерживается мутациями ниже
            key={ids[index] ?? index}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <ExpandableTextarea
              header={`Вариант ${index + 1}`}
              placeholder="Первое сообщение персонажа в новом чате…"
              value={msg}
              rows={6}
              onChange={(e) => updateAt(index, e.target.value)}
            />
            <div className="char-field__meta">
              <Caption level="1" className="char-field__tokens">~{estimateTokens(msg)} токенов</Caption>
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
          </motion.div>
        ))}
      </AnimatePresence>
      <Button
        size="s"
        mode="outline"
        className="char-firsts__add"
        disabled={items.length >= MAX_FIRST_MESSAGES}
        onClick={add}
      >
        + Добавить вариант
      </Button>
    </div>
  );
}
