import { Button, Loader } from "@mantine/core";
import { motion } from "framer-motion";
import { BookX, Clapperboard, CloudOff } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { EmptyState } from "../../../../shared/components/EmptyState";
import { InfiniteSentinel } from "../../../../shared/components/InfiniteSentinel";
import { useRenderWindow } from "../../../../shared/hooks/useRenderWindow";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import type { StoryLoadError } from "../../hooks/useStory";
import { followsContinue } from "../../lib/storyMessages";
import type { StoryMessage } from "../../types/story";
import { BeatDivider } from "./BeatDivider";
import { StreamingBeat } from "./StreamingBeat";
import styles from "./StoryFeed.module.css";

export interface StoryFeedHandle {
  /**
   * Не анимировать появление этого сообщения. Для бита, который подменяет потоковый: иначе он проиграл
   * бы появление поверх уже показанного текста (мелькание).
   */
  markAnimated: (messageId: number) => void;
}

interface StoryFeedProps {
  /** Идентификатор ленты: при смене окно рендера снова сжимается до хвоста. */
  storyId: number;
  messages: StoryMessage[];
  loading: boolean;
  /** Ошибка первой загрузки; null — история загружена. */
  error: StoryLoadError | null;
  onRetry: () => void;
  /** Текст генерируемого бита; null — генерации нет. */
  streamingText: string | null;
  /** Фаза фонового статуса перед битом (compacting — авто-сжатие). */
  statusPhase: string | null;
  renderMessage: (message: StoryMessage) => ReactNode;
}

/** Шаг каскада появления новых сообщений и его потолок, с. */
const STAGGER_S = 0.03;
const STAGGER_MAX_S = 0.3;

/**
 * Лента истории — единственное, что прокручивается на экране. В DOM только хвост (useRenderWindow),
 * ранние биты дорисовываются при прокрутке к верху. Новые сообщения появляются с анимацией, лента
 * держится у низа: первый раз — мгновенно, дальше — плавно. Технические «Дальше» (continue) не рисуются,
 * бит после них отделён орнаментом.
 */
export const StoryFeed = forwardRef<StoryFeedHandle, StoryFeedProps>(function StoryFeed(
  { storyId, messages, loading, error, onRetry, streamingText, statusPhase, renderMessage },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Первая прокрутка к низу (открытие истории) — мгновенная, без видимой долгой прокрутки от верха.
  const didInitialScroll = useRef(false);
  // Сообщения, чьё появление уже отыграло. Анимируем только новые: иначе перемонтирование хвоста
  // (смена ветки, откат) на длинной истории упиралось бы в задержку каскада по индексу.
  const animatedIds = useRef<Set<number>>(new Set());

  useImperativeHandle(ref, () => ({
    markAnimated: (id) => {
      animatedIds.current.add(id);
    },
  }));

  // Зависим от длины ленты, а не от содержимого: перевод и правка бита меняют текст, но не должны
  // дёргать ленту вниз.
  useEffect(() => {
    if (!messages.length) return;
    endRef.current?.scrollIntoView({ behavior: didInitialScroll.current ? "smooth" : "auto" });
    didInitialScroll.current = true;
  }, [messages.length, streamingText]);

  // После коммита все текущие сообщения считаются показанными — новыми будут только добавленные позже.
  useEffect(() => {
    for (const m of messages) animatedIds.current.add(m.id);
  }, [messages]);

  const renderWindow = useRenderWindow(scrollRef, messages.length, storyId);
  // Каскад отсчитываем от первого нового сообщения — новые появляются быстро при любой длине истории.
  const firstNewIdx = messages.findIndex((m) => !animatedIds.current.has(m.id));

  const content = () => {
    if (loading) return <Loader />;
    if (error === "not_found") {
      return <EmptyState icon={BookX} title="История не найдена" description="Возможно, она была удалена." />;
    }
    if (error) {
      return (
        <EmptyState
          icon={CloudOff}
          title="Не удалось загрузить историю"
          description="Проверьте соединение и попробуйте ещё раз."
          action={
            <Button variant="light" onClick={onRetry}>
              Повторить
            </Button>
          }
        />
      );
    }
    return <EmptyState icon={Clapperboard} title="История пуста" description="Нажмите «Дальше» — рассказчик начнёт." />;
  };

  if (loading || error || (messages.length === 0 && streamingText === null)) {
    return (
      <div ref={scrollRef} className={styles.feed}>
        <div className={styles.center}>{content()}</div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.feed}>
      <div className={styles.inner}>
        <InfiniteSentinel hasMore={renderWindow.hasMore} loading={false} onLoadMore={renderWindow.loadMore} />
        {messages.slice(renderWindow.start).map((msg, offset) => {
          // Пустая обёртка заняла бы место в gap ленты — «Дальше» не рисуем совсем.
          if (msg.kind === "continue") return null;
          const i = renderWindow.start + offset;
          const isNew = firstNewIdx >= 0 && !animatedIds.current.has(msg.id);
          const delay = isNew ? Math.min((i - firstNewIdx) * STAGGER_S, STAGGER_MAX_S) : 0;
          return (
            <motion.div
              key={msg.id}
              className={styles.item}
              initial={isNew ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...MOTION_TRANSITION, delay }}
            >
              {msg.kind === "beat" && followsContinue(messages, i) && <BeatDivider />}
              {renderMessage(msg)}
            </motion.div>
          );
        })}
        {/* Без exit-анимации: потоковый бит исчезает в том же коммите, где в ленту влит готовый
            (resync в useStoryGeneration), — кросс-фейд одинакового текста давал мелькание. */}
        {streamingText !== null && (
          <motion.div
            className={styles.item}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={MOTION_TRANSITION}
          >
            {followsContinue(messages, messages.length) && <BeatDivider />}
            <StreamingBeat text={streamingText} compacting={statusPhase === "compacting"} />
          </motion.div>
        )}
      </div>
      <div ref={endRef} />
    </div>
  );
});
