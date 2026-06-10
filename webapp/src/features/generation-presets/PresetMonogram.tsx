interface PresetMonogramProps {
  id: number;
  name: string;
}

/** Цвет фона выводим из id — стабильный (не прыгает между перерисовками) и разный у соседних строк. */
function hueFromId(id: number): number {
  // Простой множитель даёт хороший разброс оттенков для последовательных id.
  return (id * 47) % 360;
}

/**
 * Монограм пресета для строки списка: цветной кружок с первой буквой названия.
 * У пресетов нет картинок (в отличие от персонажей), поэтому цвет — единственный визуальный «якорь».
 */
export function PresetMonogram({ id, name }: PresetMonogramProps) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const background = `hsl(${hueFromId(id)} 55% 45%)`;
  return (
    <div className="preset-monogram" style={{ background }} aria-hidden>
      {letter}
    </div>
  );
}
