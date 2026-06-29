import { useCallback, useRef, useState } from "react";
import type { TranslateMode } from "../components/TranslateSheet";

export interface ComposeTranslateParams {
  text: string;
  targetLang: string;
  mode: TranslateMode;
}

/**
 * Состояние и действие перевода черновика сообщения. Один эфемерный результат (не список),
 * ref-лок против параллельных запросов. reset() очищает результат — например, при смене
 * исходного текста. Параметризован функцией перевода (RP → /chats, narrator → /stories).
 */
export function useComposeTranslate(
  translateFn: (params: ComposeTranslateParams) => Promise<string>,
) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const translate = useCallback(
    async (params: ComposeTranslateParams) => {
      if (lock.current) return;
      lock.current = true;
      setLoading(true);
      setError(null);
      try {
        setResult(await translateFn(params));
      } catch {
        setError("Не удалось перевести");
      } finally {
        lock.current = false;
        setLoading(false);
      }
    },
    [translateFn],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, translate, reset };
}
