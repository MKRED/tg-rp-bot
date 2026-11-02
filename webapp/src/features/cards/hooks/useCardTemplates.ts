import { useEffect, useState } from "react";
import { listCardTemplates } from "../api/card-templates-api";
import type { CardTemplate } from "../types/cardTemplate";

interface CardTemplatesState {
  items: CardTemplate[];
  loading: boolean;
  error: boolean;
}

/** Шаблоны карточек пользователя — для списка и для выбора шаблона в карточке (паттерн useCards). */
export function useCardTemplates(): CardTemplatesState {
  const [items, setItems] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCardTemplates()
      .then((res) => {
        if (!cancelled) setItems(res.templates);
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
