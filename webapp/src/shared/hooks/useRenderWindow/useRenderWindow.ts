import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { renderWindowStart } from "./renderWindowStart";

/** Сколько сообщений рендерим изначально и дорисовываем за одну догрузку вверх. */
export const RENDER_WINDOW_STEP = 40;

interface RenderWindow {
  /** Индекс первого отрисовываемого сообщения — рендерим `messages.slice(start)`. */
  start: number;
  /** Выше окна есть неотрисованные сообщения — показываем маячок InfiniteSentinel. */
  hasMore: boolean;
  /** Дорисовать ещё `step` сообщений сверху, сохранив видимую позицию скролла. */
  loadMore: () => void;
}

/**
 * Оконный рендер длинной ленты чата: в DOM только хвост, более ранние сообщения дорисовываются,
 * когда пользователь доскроллил до верха (маячок InfiniteSentinel). Данные при этом уже на клиенте —
 * экономим именно рендер сотен пузырей (markdown, framer-motion), а не сетевой запрос.
 *
 * Позицию скролла при дорисовке восстанавливаем вручную (разница scrollHeight до/после) — в Safari
 * нативного scroll anchoring нет. scrollTop присваиваем абсолютно, поэтому с anchoring Chrome двойной
 * компенсации не будет. Отключать anchoring (`overflow-anchor: none`) у ленты НЕЛЬЗЯ: он держит низ
 * при первом открытии, когда пузыри уже после скролла вниз меняют высоту (показ кэшированного перевода
 * в MessageBubble/useTranslatable).
 *
 * `resetKey` — идентификатор ленты (id чата/истории): при его смене окно снова сжимается до хвоста.
 */
export function useRenderWindow(
  scrollRef: RefObject<HTMLElement | null>,
  total: number,
  resetKey: unknown,
  step = RENDER_WINDOW_STEP,
): RenderWindow {
  const [frozen, setFrozen] = useState<number | null>(null);
  // Замер контейнера перед дорисовкой — применяется в layout-эффекте после коммита, до отрисовки кадра.
  const anchor = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  useEffect(() => {
    setFrozen(null);
  }, [resetKey]);

  const start = renderWindowStart(frozen, total, step);

  // Фиксируем начало окна при первой непустой ленте — дальше новые сообщения его не сдвигают.
  useEffect(() => {
    if (frozen === null && total > 0) setFrozen(start);
  }, [frozen, total, start]);

  // Ссылка меняется вместе со start — InfiniteSentinel пересоздаёт observer и, если маячок всё ещё
  // в зоне видимости (короткие сообщения), каскадно дорисует следующую порцию.
  const loadMore = useCallback(() => {
    if (start === 0) return;
    const el = scrollRef.current;
    if (el) anchor.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
    setFrozen(Math.max(0, start - step));
  }, [scrollRef, start, step]);

  useLayoutEffect(() => {
    const a = anchor.current;
    const el = scrollRef.current;
    if (!a || !el) return;
    anchor.current = null;
    el.scrollTop = a.scrollTop + (el.scrollHeight - a.scrollHeight);
  }, [start, scrollRef]);

  return { start, hasMore: start > 0, loadMore };
}
