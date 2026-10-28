import { useEffect, useState } from "react";
import { listDeepSeekModels } from "../api/deepseek-models-api";

interface DeepSeekModelsState {
  /** null — список ещё не получен (грузится или запрос упал). */
  models: string[] | null;
  loading: boolean;
  /** Ключ DeepSeek не задан или не принят — моделей не получить, нужна ссылка в настройки. */
  noKey: boolean;
}

/**
 * Список моделей DeepSeek для формы пресета — один запрос на открытие формы. Ошибку не тостим:
 * поле модели всё равно показывает сохранённую модель, а без списка её просто нельзя сменить.
 */
export function useDeepSeekModels(): DeepSeekModelsState {
  const [state, setState] = useState<DeepSeekModelsState>({ models: null, loading: true, noKey: false });

  useEffect(() => {
    let cancelled = false;
    listDeepSeekModels()
      .then((res) => {
        if (!cancelled) setState({ models: res.ok ? (res.models ?? []) : null, loading: false, noKey: !res.ok });
      })
      .catch((err) => {
        console.error("Failed to load DeepSeek models", err);
        if (!cancelled) setState({ models: null, loading: false, noKey: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
