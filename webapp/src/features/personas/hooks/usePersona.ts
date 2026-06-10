import { useEffect, useState } from "react";
import { getPersona } from "../api/personas-api";
import type { Persona } from "../types/persona";

interface PersonaState {
  persona: Persona | undefined;
  loading: boolean;
  error: boolean;
}

export function usePersona(id: number | undefined): PersonaState {
  const [persona, setPersona] = useState<Persona>();
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
    getPersona(id)
      .then((res) => {
        if (!cancelled) setPersona(res.persona);
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

  return { persona, loading, error };
}
