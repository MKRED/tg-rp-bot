import { useEffect, useState } from "react";
import { listPresets } from "./presets-api";
import type { PresetListItem } from "./types";

interface PresetsState {
  items: PresetListItem[];
  loading: boolean;
  error: boolean;
}

/**
 * Хук списка пресетов пользователя. Паттерн повторяет useCharacters (cancelled-флаг).
 * Перезапрашивать вручную не нужно: возврат с формы перемонтирует экран → эффект отрабатывает заново.
 */
export function usePresets(): PresetsState {
  const [items, setItems] = useState<PresetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPresets()
      .then((res) => {
        if (!cancelled) setItems(res.presets);
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
