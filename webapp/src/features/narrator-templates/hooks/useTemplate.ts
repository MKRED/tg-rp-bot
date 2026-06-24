import { useEffect, useState } from "react";
import { getTemplate } from "../api/templates-api";
import type { NarratorTemplate } from "../types/template";

/** Один narrator-шаблон по id (для формы правки). id undefined → режим создания. */
export function useTemplate(id: number | undefined) {
  const [template, setTemplate] = useState<NarratorTemplate>();
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
    getTemplate(id)
      .then((res) => !cancelled && setTemplate(res.template))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { template, loading, error };
}
