import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../shared/api/client";
import { getStory } from "../api/stories-api";
import type { StoryDetail, StoryMessage } from "../types/story";

/** Чем кончилась первая загрузка: ошибкой сети/сервера (можно повторить) или «нет такой истории». */
export type StoryLoadError = "failed" | "not_found";

/**
 * Загружает историю и держит локальный массив сообщений активного пути. reload() тихо перезапрашивает
 * историю (после генерации/ветвления/удаления — пересинхронизировать активный путь), retry() повторяет
 * первую загрузку после ошибки.
 */
export function useStory(id: number) {
  const [story, setStory] = useState<StoryDetail>();
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  // Ошибка только первой загрузки: провал тихого reload не должен подменять уже показанную историю.
  const [error, setError] = useState<StoryLoadError | null>(null);
  const [attempt, setAttempt] = useState(0);

  // onApplied вызывается в том же setState-батче, что и setStory/setMessages — чтобы вызывающий
  // мог снять стримящийся текст одновременно с появлением реального бита (без «дёрганья» ленты:
  // иначе сначала исчезает стрим → лента короче → скролл прыгает вверх, потом приходит бит → вниз).
  // Бросает при неудаче — onApplied зовётся и тогда, чтобы потоковый бит не «застрял».
  const reload = useCallback(
    (onApplied?: () => void) =>
      getStory(id)
        .then((res) => {
          setStory(res.story);
          setMessages(res.story.messages);
          onApplied?.();
        })
        .catch((err: unknown) => {
          onApplied?.();
          throw err;
        }),
    [id],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStory(id)
      .then((res) => {
        if (cancelled) return;
        setStory(res.story);
        setMessages(res.story.messages);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Failed to load story", err);
        setError(err instanceof ApiError && err.status === 404 ? "not_found" : "failed");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { story, messages, setMessages, loading, error, reload, retry };
}
