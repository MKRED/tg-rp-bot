import { useCallback, useRef, useState } from "react";
import { composeTranslate, type TranslateMode } from "../api/translate-api";

/**
 * Состояние и действие перевода черновика сообщения. Один эфемерный результат (не список),
 * ref-лок против параллельных запросов (как в useImpersonate). reset() очищает результат —
 * например, при смене исходного текста.
 */
export function useComposeTranslate(chatId: number) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const translate = useCallback(
    async (params: { text: string; targetLang: string; mode: TranslateMode }) => {
      if (lock.current) return;
      lock.current = true;
      setLoading(true);
      setError(null);
      try {
        const translation = await composeTranslate(chatId, params);
        setResult(translation);
      } catch {
        setError("Не удалось перевести");
      } finally {
        lock.current = false;
        setLoading(false);
      }
    },
    [chatId],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, translate, reset };
}
