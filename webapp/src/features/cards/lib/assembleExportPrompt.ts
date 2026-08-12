import type { CardCategory } from "../types/card";

/**
 * Собирает финальный промпт персонажа/персоны из enabled-категорий карточки — используется как
 * стартовое значение на экране выгрузки (CardExportPage), дальше редактируется вручную.
 * С includeHeaders=true формат "# Название\nТекст" через пустую строку зеркалит buildExampleBlock
 * (bot/src/server/cards/generation/promptAssembly.ts): та же читаемая разметка, но из готового
 * content, а не description-образца. С includeHeaders=false — только текст блоков подряд, без
 * заголовков категорий (для персонажей, которым не нужна такая разметка в промпте). Категории
 * без сгенерированного текста пропускаются в обоих случаях.
 */
export function assembleExportPrompt(categories: CardCategory[], includeHeaders = true): string {
  return categories
    .filter((c) => c.enabled && c.content.trim())
    .map((c) => (includeHeaders ? `# ${c.title}\n${c.content.trim()}` : c.content.trim()))
    .join("\n\n");
}
