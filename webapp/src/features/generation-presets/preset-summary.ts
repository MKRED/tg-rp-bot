import { REASONING_EFFORT_LABELS } from "./types";
import type { PresetListItem } from "./types";

/**
 * Компактная сводка пресета под названием в списке: ключевые поля через « · ».
 * Показываем только заданные значения (null = «не передаётся» → пропускаем), чтобы строка
 * отражала реальную конфигурацию, а не плодила «—». Порядок частей — от самого характерного.
 */
export function presetSummary(p: PresetListItem): string {
  const parts: string[] = [];

  // Температура — самый «говорящий» параметр пресета.
  if (p.temperature !== null) parts.push(`темп. ${p.temperature.toFixed(2)}`);

  // Контекст: безлимит важнее конкретного размера; иначе показываем размер, если задан.
  if (p.contextUnlimited) parts.push("контекст ∞");
  else if (p.contextSize !== null) parts.push(`контекст ${p.contextSize}`);

  if (p.maxTokens !== null) parts.push(`${p.maxTokens} ток.`);
  if (p.streaming) parts.push("стриминг");

  // Рассуждение показываем, только если оно запрошено и выбран уровень.
  if (p.requestReasoning && p.reasoningEffort) {
    parts.push(`рассужд. ${REASONING_EFFORT_LABELS[p.reasoningEffort].toLowerCase()}`);
  }

  // Пустая конфигурация (всё по умолчанию провайдера) — нейтральная подпись вместо пустоты.
  return parts.length > 0 ? parts.join(" · ") : "Параметры по умолчанию";
}
