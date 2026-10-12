import { Text, UnstyledButton } from "@mantine/core";
import { Check, Shuffle } from "lucide-react";
import { useState } from "react";
import { PickerTrigger } from "../../../../shared/components/PickerField";
import { ResponsiveSheet } from "../../../../shared/components/ResponsiveSheet";
import type { GreetingChoice } from "../../lib/greetingChoice";
import styles from "./GreetingField.module.css";

interface GreetingFieldProps {
  /** Приветствия выбранного персонажа (firstMessages). */
  greetings: string[];
  /** Полный персонаж ещё грузится — приветствия неизвестны. */
  loading: boolean;
  value: GreetingChoice;
  onChange: (value: GreetingChoice) => void;
}

/** Текст поля и подпись под ним для текущего выбора. */
function describe(value: GreetingChoice, greetings: string[], loading: boolean) {
  // Пока персонаж грузится — нейтрально, без ложного «нет приветствий».
  if (loading) return { title: "Загрузка…", subtitle: undefined };
  if (value === "random") return { title: "Случайное", subtitle: "Одно из приветствий наугад" };
  if (value === null) return { title: "Без приветствия", subtitle: "У персонажа нет приветствий — чат начнётся пустым" };
  return { title: greetings[value] ?? "", subtitle: `Приветствие ${value + 1} из ${greetings.length}` };
}

/**
 * Выбор первого сообщения чата из приветствий персонажа. Не общий PickerField: варианты — длинные тексты
 * (в списке видно по несколько строк), есть «Случайное» и состояние «приветствий нет».
 */
export function GreetingField({ greetings, loading, value, onChange }: GreetingFieldProps) {
  const [opened, setOpened] = useState(false);
  const { title, subtitle } = describe(value, greetings, loading);

  const pick = (next: GreetingChoice) => {
    onChange(next);
    setOpened(false);
  };

  return (
    <>
      <PickerTrigger
        label="Приветствие"
        title={title}
        subtitle={subtitle}
        disabled={loading || greetings.length === 0}
        onClick={() => setOpened(true)}
      />

      <ResponsiveSheet opened={opened} onClose={() => setOpened(false)} title="Приветствие">
        <div className={styles.list}>
          {/* «Случайное» имеет смысл только при двух вариантах и больше. */}
          {greetings.length >= 2 && (
            <UnstyledButton className={styles.option} onClick={() => pick("random")}>
              <Shuffle size={20} className={styles.icon} aria-hidden />
              <Text fw={500} className={styles.text}>
                Случайное
              </Text>
              {value === "random" && <Check size={18} className={styles.check} aria-label="Выбрано" />}
            </UnstyledButton>
          )}
          {greetings.map((g, i) => (
            <UnstyledButton key={i} className={styles.option} onClick={() => pick(i)}>
              <div className={styles.text}>
                <Text size="xs" c="dimmed" fw={600}>
                  Приветствие {i + 1}
                </Text>
                <Text size="sm" lineClamp={4}>
                  {g}
                </Text>
              </div>
              {value === i && <Check size={18} className={styles.check} aria-label="Выбрано" />}
            </UnstyledButton>
          ))}
        </div>
      </ResponsiveSheet>
    </>
  );
}
