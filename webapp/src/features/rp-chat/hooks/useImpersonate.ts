import { useCallback, useRef, useState } from "react";
import { listImpersonations, streamImpersonate } from "../api/index";
import type { ImpersonationVariant } from "../types/chat";

/**
 * Состояние и действия окна генерации реплик «от лица пользователя».
 * load() подтягивает сохранённые варианты момента; если их нет — сразу генерирует первый.
 * generate() стримит новый вариант (если токены приходят — видно набор; если нет — спиннер до done).
 */
export function useImpersonate(chatId: number) {
  const [variants, setVariants] = useState<ImpersonationVariant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  // Лок против параллельных генераций — ref, чтобы generate оставался стабильным (deps [chatId]).
  const genLock = useRef(false);

  const generate = useCallback(async () => {
    if (genLock.current) return;
    genLock.current = true;
    setGenerating(true);
    setStreamingText("");
    try {
      await streamImpersonate(chatId, {
        onToken: (t) => setStreamingText((prev) => (prev ?? "") + t),
        onDone: (variant) => {
          setStreamingText(null);
          setVariants((prev) => [variant, ...prev]);
        },
        onError: () => setStreamingText(null),
      });
    } finally {
      genLock.current = false;
      setGenerating(false);
      setStreamingText(null);
    }
  }, [chatId]);

  const load = useCallback(async () => {
    const list = await listImpersonations(chatId);
    setVariants(list);
    if (list.length === 0) await generate();
  }, [chatId, generate]);

  return { variants, generating, streamingText, load, generate };
}
