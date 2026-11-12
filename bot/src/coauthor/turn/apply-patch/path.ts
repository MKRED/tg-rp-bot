/**
 * Путь блока для apply_patch: `cards/<card_id>/<block_id>.md`. Блоки — не файлы, но модель обучена
 * патчить файлы, поэтому каждому блоку даём путь (поле path в get_card).
 */
export function blockPath(cardId: number, blockId: string): string {
  return `cards/${cardId}/${blockId}.md`;
}

/** Обратное blockPath(); терпит «./» или «/» в начале и отсутствие «.md». undefined — путь не наш. */
export function parseBlockPath(path: string): { cardId: number; blockId: string } | undefined {
  const match = /^(?:\.?\/)?cards\/(\d+)\/(.+?)(?:\.md)?$/.exec(path.trim());
  return match ? { cardId: Number(match[1]), blockId: match[2]! } : undefined;
}
