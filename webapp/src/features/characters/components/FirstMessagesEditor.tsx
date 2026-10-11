import { Button, Group, Stack } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { MOTION_TRANSITION } from "../../../shared/theme/motion";
import { MAX_FIRST_MESSAGES } from "../types/character";

interface FirstMessagesEditorProps {
  messages: string[];
  onChange: (messages: string[]) => void;
}

/**
 * Редактор вариантов первого сообщения: каждый вариант — превью с полноэкранным редактором (как поля
 * промптов, со счётчиком токенов), добавление/удаление. При старте нового чата бот возьмёт один из вариантов. «Добавить» блокируется на лимите
 * (MAX_FIRST_MESSAGES) — серверная проверка дублирует его.
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
    <Stack gap={0}>
      <AnimatePresence initial={false}>
        {items.map((msg, index) => (
          <motion.div
            // фолбэк на индекс — на один кадр рассинхрона ids/items (внешняя смена длины),
            // чтобы не словить key=undefined; в норме ids поддерживается мутациями выше
            key={ids[index] ?? index}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={MOTION_TRANSITION}
            // overflow — чтобы при анимации высоты содержимое не вылезало; отступ снизу — внутри
            // анимируемого блока, иначе он «прыгал» бы в конце анимации.
            style={{ overflow: "hidden" }}
          >
            <Stack gap={4} pb="md">
              <PromptEditorField
                header={`Вариант ${index + 1}`}
                placeholder="Первое сообщение персонажа в новом чате…"
                value={msg}
                onChange={(v) => updateAt(index, v)}
              />
              {items.length > 1 && (
                <Group justify="flex-end">
                  <Button variant="subtle" color="red" size="compact-sm" onClick={() => removeAt(index)}>
                    Удалить вариант
                  </Button>
                </Group>
              )}
            </Stack>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button
        variant="light"
        leftSection={<Plus size={18} />}
        disabled={items.length >= MAX_FIRST_MESSAGES}
        onClick={add}
      >
        Добавить вариант
      </Button>
    </Stack>
  );
}
