import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../shared/toast";
import { getWebSearchSettings, saveWebSearchSettings } from "../api/web-search-settings-api";
import { DEFAULT_SEARCH_ROUNDS } from "../lib/searchRounds";

/**
 * Состояние карточки «Веб-поиск»: только лимит раундов — ключа у поиска нет, он идёт через ключ
 * DeepSeek. Локальное значение ползунка — отклик на каждый шаг перетаскивания; PATCH — один, когда
 * палец отпущен (onChangeEnd), а не на каждый промежуточный шаг.
 */
export function useWebSearchSettings() {
  const [savedRounds, setSavedRounds] = useState(DEFAULT_SEARCH_ROUNDS);
  const [maxSearchRounds, setMaxSearchRounds] = useState(DEFAULT_SEARCH_ROUNDS);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    getWebSearchSettings()
      .then(({ maxSearchRounds: rounds }) => {
        setSavedRounds(rounds);
        setMaxSearchRounds(rounds);
      })
      .catch((err) => console.error("Failed to load web search settings", err))
      .finally(() => setLoading(false));
  }, []);

  const saveMaxSearchRounds = useCallback(
    (value: number) => {
      saveWebSearchSettings({ maxSearchRounds: value })
        .then(({ maxSearchRounds: rounds }) => {
          setSavedRounds(rounds);
          setMaxSearchRounds(rounds);
        })
        .catch((err) => {
          console.error("Failed to save max search rounds", err);
          showToast({ type: "error", message: "Не удалось сохранить лимит раундов поиска." });
          // Ползунок возвращаем к сохранённому значению — не показываем то, чего на сервере нет.
          setMaxSearchRounds(savedRounds);
        });
    },
    [showToast, savedRounds],
  );

  return { loading, maxSearchRounds, setMaxSearchRounds, saveMaxSearchRounds };
}
