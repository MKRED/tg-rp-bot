import { useEffect, useState } from "react";
import { listBooks } from "../api/books-api";
import type { BookListItem } from "../types/book";

/** Список книг знаний пользователя (паттерн cancelled-флага, как usePresets). */
export function useBooks() {
  const [items, setItems] = useState<BookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBooks()
      .then((res) => !cancelled && setItems(res.books))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
