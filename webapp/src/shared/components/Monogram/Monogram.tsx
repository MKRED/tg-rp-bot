import { Avatar } from "@mantine/core";

interface MonogramProps {
  /** Выбирает цвет: стабильно между перерисовками и разный у соседних строк. */
  id: number;
  name: string;
  size?: number;
}

/** Цвета монограмм из палитры Mantine. */
const MONOGRAM_COLORS = ["blue", "grape", "teal", "orange", "pink", "cyan", "lime", "violet"];

/**
 * Монограмма для строки списка: цветной кружок с первой буквой названия. Для записей без картинки
 * (пресеты, карточки) — цвет и буква единственный визуальный «якорь» в списке.
 */
export function Monogram({ id, name, size = 48 }: MonogramProps) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <Avatar size={size} color={MONOGRAM_COLORS[id % MONOGRAM_COLORS.length]} aria-hidden>
      {letter}
    </Avatar>
  );
}
