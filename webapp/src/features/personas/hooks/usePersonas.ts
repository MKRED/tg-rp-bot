import { useEffect, useState } from "react";
import { listPersonas } from "../api/personas-api";
import type { PersonaListItem } from "../types/persona";

interface PersonasState {
  items: PersonaListItem[];
  loading: boolean;
  error: boolean;
}

export function usePersonas(): PersonasState {
  const [items, setItems] = useState<PersonaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPersonas()
      .then((res) => {
        if (!cancelled) setItems(res.personas);
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
