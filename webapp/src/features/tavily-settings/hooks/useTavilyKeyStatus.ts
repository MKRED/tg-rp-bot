import { useEffect, useState } from "react";
import { getTavilySettings } from "../api/tavily-settings-api";

/**
 * Лёгкий статус ключа Tavily — только hasKey, без квоты/verify (useTavilySettings тянет квоту
 * через проксированный Tavily /usage при каждом монтировании, что не нужно потребителям вроде
 * CardForm: там достаточно знать, доступен ли переключатель веб-поиска).
 */
export function useTavilyKeyStatus(): { hasKey: boolean; loading: boolean } {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTavilySettings()
      .then((status) => {
        if (!cancelled) setHasKey(status.hasKey);
      })
      .catch((err) => console.error("Failed to load Tavily key status", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { hasKey, loading };
}
