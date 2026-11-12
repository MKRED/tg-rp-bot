import { ActionIcon, Text, UnstyledButton } from "@mantine/core";
import { Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { ListRow } from "../../../../../shared/components/ListCard";
import { Monogram } from "../../../../../shared/components/Monogram";
import { formatRelativeDate } from "../../../../../shared/text/formatRelativeDate";
import { selectedCardOptions } from "../../../lib/cardsPicker";
import { MAX_COAUTHOR_CARDS, type CoauthorCardOption } from "../../../types/coauthor";
import styles from "./CardsField.module.css";
import { CardsSheet } from "./CardsSheet";

interface CardsFieldProps {
  options: CoauthorCardOption[];
  loading: boolean;
  value: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Карточки чата: в форме — только выбранные (компактно, с ✕), остальные выбираются в шторке с поиском.
 * Форма не растёт от числа карточек у пользователя, а выбор устроен так же, как у пресета ниже.
 * Порядок в чате — порядок выбора (так карточки видят модель и экран).
 */
export function CardsField({ options, loading, value, onChange }: CardsFieldProps) {
  const [opened, setOpened] = useState(false);
  const selected = selectedCardOptions(options, value);
  const full = value.length >= MAX_COAUTHOR_CARDS;

  return (
    <div className={styles.field}>
      <Text fw={500}>
        Карточки{" "}
        <Text span size="sm" c="dimmed">
          · {value.length} из {MAX_COAUTHOR_CARDS}
        </Text>
      </Text>

      {loading ? (
        <Text size="sm" c="dimmed">
          Загрузка…
        </Text>
      ) : options.length === 0 ? (
        <Text size="sm" c="dimmed">
          Карточек пока нет — создайте их в разделе «Карточки».
        </Text>
      ) : (
        <>
          {selected.length > 0 && (
            <div className={styles.selected}>
              {selected.map((card, i) => (
                <ListRow
                  key={card.id}
                  index={i}
                  layout
                  leading={<Monogram id={card.id} name={card.name} size={36} />}
                  title={card.name}
                  description={`изменена ${formatRelativeDate(card.updatedAt)}`}
                  trailing={
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xl"
                      aria-label={`Убрать «${card.name}» из чата`}
                      onClick={() => onChange(value.filter((id) => id !== card.id))}
                    >
                      <X size={18} />
                    </ActionIcon>
                  }
                />
              ))}
            </div>
          )}
          <UnstyledButton className={styles.add} onClick={() => setOpened(true)}>
            {full ? <Pencil size={16} aria-hidden /> : <Plus size={18} aria-hidden />}
            {/* На лимите кнопка не гаснет: в шторке можно снять одну карточку и выбрать другую. */}
            {full ? "Изменить выбор" : "Добавить карточку"}
          </UnstyledButton>
        </>
      )}

      <CardsSheet opened={opened} onClose={() => setOpened(false)} options={options} value={value} onChange={onChange} />
    </div>
  );
}
