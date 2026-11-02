import { useEffect, useState } from "react";
import { getCardTemplate } from "../api/card-templates-api";
import type { CardTemplate } from "../types/cardTemplate";

/** Один шаблон карточки по id (для формы правки). id undefined → режим создания. */
export function useCardTemplate(id: number | undefined) {
  const [template, setTemplate] = useState<CardTemplate>();
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
    getCardTemplate(id)
      .then((res) => !cancelled && setTemplate(res.template))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { template, loading, error };
}
