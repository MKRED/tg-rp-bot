import { useMemo } from "react";
import { buildTagSuggestions, type TagSuggestion } from "../lib/tagSuggestions";
import { useCharacters } from "./useCharacters";

/**
 * Подсказки тегов для ввода: берёт расшифрованные теги всех персонажей пользователя
 * (useCharacters) и агрегирует частоты под текущий черновик. Уже выбранные теги исключены.
 * Чистая часть вынесена в buildTagSuggestions — здесь только источник данных + мемоизация.
 */
export function useTagSuggestions(selected: string[], draft: string): TagSuggestion[] {
  const { items } = useCharacters();
  return useMemo(
    () => buildTagSuggestions(items, selected, draft),
    [items, selected, draft],
  );
}
