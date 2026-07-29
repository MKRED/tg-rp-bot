import { useEffect, useState } from "react";
import { getCard } from "../api/cards-api";
import type { Card } from "../types/card";

interface CardState {
  card: Card | undefined;
  loading: boolean;
  error: boolean;
}

export function useCard(id: number | undefined): CardState {
  const [card, setCard] = useState<Card>();
  const [loading, setLoading] = useState(id !== undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (id === undefined) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getCard(id)
      .then((res) => {
        if (!cancelled) setCard(res.card);
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
  }, [id]);

  return { card, loading, error };
}
