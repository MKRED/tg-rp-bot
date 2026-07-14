import { Spinner } from "@telegram-apps/telegram-ui";
import { useEffect, useRef } from "react";
import "./InfiniteSentinel.css";

interface InfiniteSentinelProps {
  hasMore: boolean;
  loading: boolean;
  /** Не удалось догрузить последнюю страницу — показываем тап-для-повтора вместо спиннера. */
  error?: boolean;
  onLoadMore: () => void;
}

/**
 * Маячок бесконечного скролла — рендерится последним элементом списка. root:null (viewport)
 * корректно клипается промежуточным overflow-y:auto контейнером секции tgui, поэтому не нужен
 * ref на её внутренний DOM. onLoadMore сам гардит повторные вызовы (см. useInfiniteList), так
 * что здесь можно не следить за loadingMore при повторной инициализации observer'а —
 * пересборка эффекта при смене onLoadMore (после каждой успешной подгрузки) и есть механизм
 * «каскадной» подгрузки: пока маячок не уехал за пределы экрана, он продолжит запускать loadMore.
 *
 * После ОШИБКИ подгрузки onLoadMore не меняет свою ссылку (page не увеличился), поэтому эффект
 * не пересоздаст observer и автоматического повтора не будет, пока маячок не покинет и не
 * вернётся в зону видимости — намеренно, чтобы не заспамить бэкенд, если он временно недоступен.
 * Вместо этого при error показываем кнопку явного повтора по тапу.
 */
export function InfiniteSentinel({ hasMore, loading, error = false, onLoadMore }: InfiniteSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="infinite-sentinel">
      {error ? (
        <button type="button" className="infinite-sentinel__retry" onClick={onLoadMore}>
          Не удалось загрузить — повторить
        </button>
      ) : loading ? (
        <Spinner size="s" />
      ) : null}
    </div>
  );
}
