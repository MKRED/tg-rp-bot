import { Button, Text, TextInput } from "@mantine/core";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import { ListRow } from "../../../../../shared/components/ListCard";
import { Monogram } from "../../../../../shared/components/Monogram";
import { ResponsiveSheet } from "../../../../../shared/components/ResponsiveSheet";
import { formatRelativeDate } from "../../../../../shared/text/formatRelativeDate";
import { filterCardOptions, toggleCardId } from "../../../lib/cardsPicker";
import { MAX_COAUTHOR_CARDS, type CoauthorCardOption } from "../../../types/coauthor";
import styles from "./CardsField.module.css";

interface CardsSheetProps {
  opened: boolean;
  onClose: () => void;
  options: CoauthorCardOption[];
  value: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Шторка выбора карточек (на ПК — окно): поиск по имени и список в порядке «свежие сверху» (так их отдаёт
 * API карточек). Отметка применяется сразу — «Готово» только закрывает. Поиск без автофокуса: на телефоне
 * он сразу открыл бы клавиатуру на пол-экрана, а в коротком списке искать не нужно.
 */
export function CardsSheet({ opened, onClose, options, value, onChange }: CardsSheetProps) {
  const [query, setQuery] = useState("");
  const full = value.length >= MAX_COAUTHOR_CARDS;
  const visible = filterCardOptions(options, query);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <ResponsiveSheet opened={opened} onClose={close} title={`Карточки чата · ${value.length} из ${MAX_COAUTHOR_CARDS}`}>
      <TextInput
        aria-label="Поиск по имени"
        placeholder="Поиск по имени"
        leftSection={<Search size={16} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        mb="xs"
      />
      <div className={styles.list}>
        {visible.map((card, i) => {
          const checked = value.includes(card.id);
          return (
            <ListRow
              key={card.id}
              index={i}
              chevron={false}
              disabled={!checked && full}
              leading={<Monogram id={card.id} name={card.name} size={36} />}
              title={card.name}
              description={`изменена ${formatRelativeDate(card.updatedAt)}`}
              meta={
                <span className={styles.check} data-checked={checked || undefined} aria-label={checked ? "Выбрана" : undefined}>
                  {checked && <Check size={14} strokeWidth={3} />}
                </span>
              }
              onClick={() => onChange(toggleCardId(value, card.id, MAX_COAUTHOR_CARDS))}
            />
          );
        })}
        {visible.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            Ничего не нашлось
          </Text>
        )}
      </div>
      <div className={styles.footer}>
        {full && (
          <Text size="xs" c="dimmed" ta="center">
            Больше {MAX_COAUTHOR_CARDS} карточек в чате нельзя — снимите одну, чтобы выбрать другую
          </Text>
        )}
        <Button fullWidth onClick={close}>
          Готово
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
