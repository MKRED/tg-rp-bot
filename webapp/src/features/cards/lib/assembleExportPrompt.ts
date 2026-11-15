import type { CardCategory } from "../types/card";

/** Как размечены блоки в выгруженном промпте: «# Название», XML-теги или никак. */
export type ExportMarkup = "headers" | "tags" | "plain";

/**
 * Имя тега из названия блока: snake_case из букв и цифр («Hobbies / Likes» → hobbies_likes). Буквы любого
 * алфавита остаются — модели читают и кириллические теги. Название без букв и цифр — тег по id блока.
 */
export function blockTagName(category: Pick<CardCategory, "id" | "title">): string {
  const name = category.title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join("_");
  return name || category.id;
}

function markBlock(category: CardCategory, markup: ExportMarkup): string {
  const text = category.content.trim();
  if (markup === "headers") return `# ${category.title}\n${text}`;
  if (markup === "tags") {
    const tag = blockTagName(category);
    return `<${tag}>\n${text}\n</${tag}>`;
  }
  return text;
}

/**
 * Собирает финальный промпт персонажа/персоны из enabled-категорий карточки — используется как
 * стартовое значение на экране выгрузки (CardExportPage), дальше редактируется вручную.
 * «headers» — формат "# Название\nТекст", зеркалит buildExampleBlock (bot/src/cards/generation/
 * prompt-assembly.ts), но из готового content. «tags» — каждый блок в <название_блока>…</название_блока>,
 * для промптов, где границы блоков должны быть однозначными. «plain» — только текст блоков подряд.
 * Блоки разделены пустой строкой; категории без сгенерированного текста пропускаются.
 */
export function assembleExportPrompt(categories: CardCategory[], markup: ExportMarkup = "headers"): string {
  return categories
    .filter((c) => c.enabled && c.content.trim())
    .map((c) => markBlock(c, markup))
    .join("\n\n");
}
