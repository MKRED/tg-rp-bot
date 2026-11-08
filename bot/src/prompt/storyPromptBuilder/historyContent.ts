import type { StoryMessage } from "@tg-rp-bot/shared";

/**
 * Обёртка живой директивы режиссёра: XML-тег однозначно отделяет out-of-character инструкцию от текста
 * истории (модель не путает её с репликой и не цитирует). Тег — та же конвенция, что `<componentId>`
 * у mergeSystemPrompts. Оборачивается ТОЛЬКО при сборке промпта — в БД хранится исходный текст.
 */
export function wrapDirective(text: string): string {
  return `<directive>\n${text}\n</directive>`;
}

/**
 * Текст узла активного пути В ТОМ ВИДЕ, в каком он уходит в модель. Единый источник для эмиссии
 * (buildStoryMessages) и подсчёта токенов (обрезка истории, план сжатия) — иначе бюджет разъедется
 * с фактическим промптом.
 *   - отыгранный user-ход (не последний) → continueMarker (последствие уже в следующем бите);
 *   - живая директива (последний узел) → обёрнута в `<directive>`;
 *   - остальное (биты, живой continue — это сам маркер) → как есть.
 */
export function storyHistoryContent(m: StoryMessage, isLast: boolean, continueMarker: string): string {
  if (m.role !== "user") return m.content;
  if (!isLast) return continueMarker;
  return m.kind === "directive" ? wrapDirective(m.content) : m.content;
}
