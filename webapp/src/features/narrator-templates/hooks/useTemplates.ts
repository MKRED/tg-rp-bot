import { useEffect, useState } from "react";
import { listTemplates } from "../api/templates-api";
import type { NarratorTemplateListItem } from "../types/template";

/** Список narrator-шаблонов пользователя. */
export function useTemplates() {
  const [items, setItems] = useState<NarratorTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((res) => !cancelled && setItems(res.templates))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
