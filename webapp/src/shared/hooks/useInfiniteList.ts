import { useCallback, useEffect, useRef, useState } from "react";

export interface InfinitePage<T> {
  items: T[];
  total: number;
}

interface InfiniteListState<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  /** Ошибка первичной загрузки — блокирует страницу целиком (ветка error в разметке хаба). */
  error: boolean;
  /** Ошибка догрузки следующей страницы — НЕ должна прятать уже отрендеренный список,
   *  поэтому отделена от error и отображается только у маячка (InfiniteSentinel). */
  loadMoreError: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Пагинация с АППЕНДОМ страниц (не заменой) — для бесконечного скролла хабов, у которых, в отличие
 * от персонажей/персон/книг (MAX_..._PER_USER = 50, помещаются в один запрос), нет лимита на
 * количество записей.
 *
 * Дедуп по id страхует от «переезда» записей между страницами: список сортируется по времени
 * последнего сообщения, и офсетная пагинация по изменяемой сортировке может задвоить элемент,
 * если он поднялся наверх между двумя запросами (пропуски — редкий приемлемый компромисс).
 * Важно: hasMore считаем от «сырой» серверной пагинации (page*pageSize < total), а НЕ от
 * items.length — если дедуп срежет дубли, items.length отстанет от total навсегда, и hasMore
 * никогда не станет false (маячок будет вечно пытаться догрузить уже исчерпанный список).
 *
 * fetchPage должна быть стабильной ссылкой (module-level функция API, не инлайн-замыкание) —
 * иначе loadMore пересоздаётся чаще, чем нужно, и лишний раз переинициализирует IntersectionObserver
 * в InfiniteSentinel.
 *
 * pageSize по умолчанию — максимум, разрешённый бэкендом (Math.min(50, ...) в chats.controller.ts/
 * stories.controller.ts). Хабы с батч-догрузкой по элементам страницы (напр. AvatarStack в narrator)
 * передают меньшее значение — иначе загрузка страницы веерит N параллельных батч-запросов.
 */
export function useInfiniteList<T extends { id: number }>(
  fetchPage: (page: number, pageSize: number) => Promise<InfinitePage<T>>,
  pageSize = 50,
): InfiniteListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const inFlight = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    inFlight.current = true;
    fetchPage(1, pageSize)
      .then(({ items: newItems, total: newTotal }) => {
        if (cancelled) return;
        setItems(newItems);
        setHasMore(pageSize < newTotal);
        setPage(1);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        inFlight.current = false;
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (inFlight.current || loading || !hasMore) return;
    inFlight.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    const nextPage = page + 1;
    fetchPage(nextPage, pageSize)
      .then(({ items: newItems, total: newTotal }) => {
        if (!mountedRef.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...newItems.filter((i) => !seen.has(i.id))];
        });
        setHasMore(nextPage * pageSize < newTotal);
        setPage(nextPage);
      })
      .catch(() => {
        if (mountedRef.current) setLoadMoreError(true);
      })
      .finally(() => {
        inFlight.current = false;
        if (mountedRef.current) setLoadingMore(false);
      });
  }, [fetchPage, page, loading, hasMore, pageSize]);

  return { items, loading, loadingMore, error, loadMoreError, hasMore, loadMore };
}
