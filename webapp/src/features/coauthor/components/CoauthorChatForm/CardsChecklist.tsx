import { Checkbox, Group, Stack, Text } from "@mantine/core";
import { MAX_COAUTHOR_CARDS, type CoauthorCardOption } from "../../types/coauthor";

interface CardsChecklistProps {
  options: CoauthorCardOption[];
  loading: boolean;
  value: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Выбор карточек чата галочками. Порядок в чате — порядок выбора (так модель и экран видят карточки).
 * На лимите невыбранные гаснут, а не прячутся: видно, что выбрать можно, если снять другую.
 */
export function CardsChecklist({ options, loading, value, onChange }: CardsChecklistProps) {
  const full = value.length >= MAX_COAUTHOR_CARDS;
  const toggle = (id: number, checked: boolean) => onChange(checked ? [...value, id] : value.filter((v) => v !== id));

  return (
    <Stack gap="xs">
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
        options.map((card) => {
          const checked = value.includes(card.id);
          return (
            <Checkbox.Card
              key={card.id}
              radius="md"
              p="sm"
              checked={checked}
              disabled={!checked && full}
              onClick={() => (checked || !full) && toggle(card.id, !checked)}
            >
              <Group gap="sm" wrap="nowrap">
                <Checkbox.Indicator disabled={!checked && full} />
                <Text size="sm">{card.name}</Text>
              </Group>
            </Checkbox.Card>
          );
        })
      )}
    </Stack>
  );
}
