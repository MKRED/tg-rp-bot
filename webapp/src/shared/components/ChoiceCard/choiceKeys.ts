/**
 * Индекс варианта после нажатия клавиши в группе radio (WAI-ARIA radiogroup): стрелки вперёд/назад
 * по кругу, Home/End — первый/последний. null — клавиша не навигационная.
 */
export function nextChoiceIndex(current: number, key: string, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
