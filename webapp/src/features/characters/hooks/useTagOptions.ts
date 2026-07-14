import { useMemo } from "react";
import { buildTagOptions, type TagOption } from "../lib/tagOptions";
import { useCharacters } from "./useCharacters";

/**
 * Опции тегов для Multiselect: берёт расшифрованные теги всех персонажей пользователя
 * (useCharacters) и агрегирует частоты. Чистая часть вынесена в buildTagOptions — здесь только
 * источник данных + мемоизация.
 */
export function useTagOptions(): TagOption[] {
  const { items } = useCharacters();
  return useMemo(() => buildTagOptions(items), [items]);
}
