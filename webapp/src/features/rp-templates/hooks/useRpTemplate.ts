import { useEffect, useState } from "react";
import { getRpTemplate } from "../api/rp-templates-api";
import type { RpTemplate } from "../types/template";

/** Один RP-шаблон по id (для формы правки). id undefined → режим создания. */
export function useRpTemplate(id: number | undefined) {
  const [template, setTemplate] = useState<RpTemplate>();
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
    getRpTemplate(id)
      .then((res) => !cancelled && setTemplate(res.template))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { template, loading, error };
}
