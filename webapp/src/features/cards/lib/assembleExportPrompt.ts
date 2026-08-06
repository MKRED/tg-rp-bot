import type { CardCategory } from "../types/card";

/**
 * Собирает финальный промпт персонажа/персоны из enabled-категорий карточки — используется как
 * стартовое значение на экране выгрузки (CardExportPage), дальше редактируется вручную.
 * Формат "# Название\nТекст" через пустую строку зеркалит buildExampleBlock
 * (bot/src/server/cards/generation/promptAssembly.ts): та же читаемая разметка, но из готового
 * content, а не description-образца. Категории без сгенерированного текста пропускаются.
 */
export function assembleExportPrompt(categories: CardCategory[]): string {
  return categories
    .filter((c) => c.enabled && c.content.trim())
    .map((c) => `# ${c.title}\n${c.content.trim()}`)
    .join("\n\n");
}
