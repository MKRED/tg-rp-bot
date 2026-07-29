import { useEffect, useState } from "react";
import { listCards } from "../api/cards-api";
import type { CardListItem } from "../types/card";

interface CardsState {
  items: CardListItem[];
  loading: boolean;
  error: boolean;
}

/**
 * Хук списка карточек пользователя. Паттерн повторяет useCharacters/usePersonas
 * (cancelled-флаг, перезапрос не нужен — возврат со страницы формы перемонтирует экран).
 */
export function useCards(): CardsState {
  const [items, setItems] = useState<CardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCards()
      .then((res) => {
        if (!cancelled) setItems(res.cards);
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
