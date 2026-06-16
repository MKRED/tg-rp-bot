import { useCallback, useRef, useState } from "react";
import { deleteImpersonation, listImpersonations, streamImpersonate } from "../api/impersonate-api";
import type { ImpersonationVariant } from "../types/chat";

/**
 * Состояние и действия окна генерации реплик «от лица пользователя».
 * load() подтягивает сохранённые варианты момента; если их нет — сразу генерирует первый.
 * generate() стримит новый вариант (если токены приходят — видно набор; если нет — спиннер до done).
 */
export function useImpersonate(chatId: number) {
  const [variants, setVariants] = useState<ImpersonationVariant[]>([]);
  const [loading, setLoading] = useState(true); // первичная загрузка истории вариантов
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
        onReset: () => setStreamingText(""), // ретрай: стираем плохой вариант
        onDone: (variant) => {
          setStreamingText(null);
          setVariants((prev) => [...prev, variant]); // новые — в конец списка (снизу)
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
    setLoading(true);
    let list: ImpersonationVariant[];
    try {
      list = await listImpersonations(chatId);
    } finally {
      setLoading(false);
    }
    // Сервер отдаёт варианты новыми-первыми; в окне показываем старые сверху, новые снизу.
    setVariants(list.slice().reverse());
    // Пусто → сразу генерируем первый (его покажет уже generating-стейт, не loading).
    if (list.length === 0) await generate();
  }, [chatId, generate]);

  // Удаление варианта: оптимистично убираем из списка, затем зовём API. На ошибке возвращаем.
  const remove = useCallback(async (variantId: number) => {
    const prev = variants;
    setVariants((list) => list.filter((v) => v.id !== variantId));
    try {
      await deleteImpersonation(chatId, variantId);
    } catch {
      setVariants(prev); // откат при сбое
    }
  }, [chatId, variants]);

  return { variants, loading, generating, streamingText, load, generate, remove };
}
