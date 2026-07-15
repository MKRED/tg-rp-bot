import { useEffect, useState } from "react";
import { listRpTemplates } from "../api/rp-templates-api";
import type { RpTemplateListItem } from "../types/template";

/** Список RP-шаблонов пользователя. */
export function useRpTemplates() {
  const [items, setItems] = useState<RpTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listRpTemplates()
      .then((res) => !cancelled && setItems(res.templates))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
