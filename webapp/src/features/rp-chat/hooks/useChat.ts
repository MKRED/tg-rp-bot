import { useCallback, useEffect, useState } from "react";
import { getChat } from "../api/chats-api";
import type { ChatDetail } from "../types/chat";

export function useChat(id: number) {
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Тихий refresh: НЕ трогает loading — иначе на каждом свопе после генерации в ленту
  // вставлялся бы flex-спиннер и дёргал layout (Warning ревьюера). onApplied вызывается
  // в том же setState-батче, что и setChat — атомарная подмена стрима на реальный бит
  // (без схлопывания ленты). В .catch его тоже зовём, чтобы стрим-пузырь не «застрял»
  // при провале refresh. Зеркало нарраторского reload (useStory).
  const refresh = useCallback((onApplied?: () => void) => {
    return getChat(id)
      .then((data) => { setChat(data); onApplied?.(); })
      .catch(() => { setError(true); onApplied?.(); });
  }, [id]);

  // Начальная загрузка — отдельно, со спиннером (loading) и guard от гонки при смене id.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getChat(id)
      .then((data) => { if (!cancelled) setChat(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { chat, loading, error, refresh, setChat };
}
