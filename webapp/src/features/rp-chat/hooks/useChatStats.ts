import { useCallback, useEffect, useState } from "react";
import { clearImpersonations } from "../api/impersonate-api";
import { getChatStats } from "../api/stats-api";
import type { ChatStats } from "../types/chat";

const EMPTY_STATS: ChatStats = {
  tokensTotal: 0,
  tokensActiveBranch: 0,
  tokensPrompt: 0,
  contextLimit: null,
  impersonationCount: 0,
};

/**
 * Статистика чата для экрана настроек: токены (весь чат / активная ветка) и число
 * сохранённых impersonate-вариантов. clearImpersonations очищает варианты и обнуляет счётчик.
 */
export function useChatStats(chatId: number) {
  const [stats, setStats] = useState<ChatStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    return getChatStats(chatId)
      .then(setStats)
      .catch((err) => console.error("Failed to load chat stats", err))
      .finally(() => setLoading(false));
  }, [chatId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const clearVariants = useCallback(async () => {
    setClearing(true);
    try {
      await clearImpersonations(chatId);
      setStats((prev) => ({ ...prev, impersonationCount: 0 }));
    } catch (err) {
      console.error("Failed to clear impersonation variants", err);
    } finally {
      setClearing(false);
    }
  }, [chatId]);

  return { stats, loading, clearing, clearVariants };
}
