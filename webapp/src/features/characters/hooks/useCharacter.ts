import { useEffect, useState } from "react";
import { getCharacter } from "../api/characters-api";
import type { Character } from "../types/character";

interface CharacterState {
  character: Character | undefined;
  loading: boolean;
  error: boolean;
}

/**
 * Хук одного персонажа по id — для формы редактирования.
 * id === undefined (режим создания) → ничего не грузим, loading=false.
 */
export function useCharacter(id: number | undefined): CharacterState {
  const [character, setCharacter] = useState<Character>();
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
    getCharacter(id)
      .then((res) => {
        if (!cancelled) setCharacter(res.character);
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

  return { character, loading, error };
}
