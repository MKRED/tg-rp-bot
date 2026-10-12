import { Avatar } from "@mantine/core";

interface PresetMonogramProps {
  id: number;
  name: string;
}

/** Цвета монограмм из палитры Mantine: по id — стабильно между перерисовками и разные у соседних строк. */
const MONOGRAM_COLORS = ["blue", "grape", "teal", "orange", "pink", "cyan", "lime", "violet"];

/**
 * Монограмма пресета для строки списка: цветной кружок с первой буквой названия.
 * У пресетов нет картинок (в отличие от персонажей), поэтому цвет — единственный визуальный «якорь».
 */
export function PresetMonogram({ id, name }: PresetMonogramProps) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <Avatar size={48} color={MONOGRAM_COLORS[id % MONOGRAM_COLORS.length]} aria-hidden>
      {letter}
    </Avatar>
  );
}
