import { useCallback, useEffect, useState } from "react";
import { getBook, listEntries, reorderEntries } from "../api/books-api";
import type { Book, Entry } from "../types/book";

/**
 * Загружает книгу + её записи для экрана редактирования. id === undefined (создание) → ничего не
 * грузим. reloadEntries() перезапрашивает список записей после add/edit/delete (без перезагрузки книги).
 */
export function useBookEditor(id: number | undefined) {
  const [book, setBook] = useState<Book>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(id !== undefined);
  const [error, setError] = useState(false);

  const reloadEntries = useCallback(() => {
    if (id === undefined) return;
    listEntries(id)
      .then((res) => setEntries(res.entries))
      .catch(() => setError(true));
  }, [id]);

  /**
   * Переставляет записи в порядок orderedIds. Оптимистично: локальный порядок меняется сразу (строки
   * едут по FLIP), запрос уходит в фон; при ошибке откатываемся перечитыванием списка с сервера.
   */
  const reorder = useCallback(
    (orderedIds: number[]) => {
      if (id === undefined) return;
      setEntries((prev) => {
        const byId = new Map(prev.map((e) => [e.id, e]));
        return orderedIds
          .map((eid) => byId.get(eid))
          .filter((e): e is Entry => e != null);
      });
      reorderEntries(id, orderedIds).catch(() => reloadEntries());
    },
    [id, reloadEntries],
  );

  useEffect(() => {
    if (id === undefined) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([getBook(id), listEntries(id)])
      .then(([b, e]) => {
        if (cancelled) return;
        setBook(b.book);
        setEntries(e.entries);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { book, entries, loading, error, reloadEntries, reorder };
}
