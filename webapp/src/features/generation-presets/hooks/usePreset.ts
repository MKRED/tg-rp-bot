import { useEffect, useState } from "react";
import { getPreset } from "../api/presets-api";
import type { Preset } from "../types/preset";

interface PresetState {
  preset: Preset | undefined;
  loading: boolean;
  error: boolean;
}

/**
 * Хук одного пресета по id — для формы редактирования.
 * id === undefined (режим создания) → ничего не грузим, loading=false.
 */
export function usePreset(id: number | undefined): PresetState {
  const [preset, setPreset] = useState<Preset>();
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
    getPreset(id)
      .then((res) => {
        if (!cancelled) setPreset(res.preset);
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

  return { preset, loading, error };
}
