import { useEffect, useState } from "react";
import { listCharacters } from "../api/characters-api";
import type { CharacterListItem } from "../types/character";

interface CharactersState {
  items: CharacterListItem[];
  loading: boolean;
  error: boolean;
}

/**
 * Хук списка персонажей пользователя. Паттерн повторяет useProfilePhoto (cancelled-флаг).
 * Список перезапрашивать вручную не нужно: возврат со страницы формы перемонтирует экран
 * (route-based навигация) → эффект отрабатывает заново.
 */
export function useCharacters(): CharactersState {
  const [items, setItems] = useState<CharacterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCharacters()
      .then((res) => {
        if (!cancelled) setItems(res.characters);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
