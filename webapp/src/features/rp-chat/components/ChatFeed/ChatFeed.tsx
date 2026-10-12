import { Loader } from "@mantine/core";
import { motion } from "framer-motion";
import { MessageCircle, MessagesSquare } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { EmptyState } from "../../../../shared/components/EmptyState";
import { InfiniteSentinel } from "../../../../shared/components/InfiniteSentinel";
import { useRenderWindow } from "../../../../shared/hooks/useRenderWindow";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import type { MessageInPath } from "../../types/chat";
import { StreamingBubble } from "../MessageBubble";
import styles from "./ChatFeed.module.css";

export interface ChatFeedHandle {
  /**
   * Не анимировать появление этого сообщения. Для ответа, который подменяет потоковый пузырь:
   * иначе он проиграл бы появление поверх уже показанного текста (мелькание).
   */
  markAnimated: (messageId: number) => void;
}

interface ChatFeedProps {
  /** Идентификатор ленты: при смене окно рендера снова сжимается до хвоста. */
  chatId: number;
  messages: MessageInPath[];
  loading: boolean;
  error: boolean;
  /** Текст генерируемого ответа; null — генерации нет. */
  streamingText: string | null;
  renderMessage: (message: MessageInPath) => ReactNode;
}

/** Шаг каскада появления новых сообщений и его потолок, с. */
const STAGGER_S = 0.03;
const STAGGER_MAX_S = 0.3;

/**
 * Лента чата — единственное, что прокручивается на экране. В DOM только хвост (useRenderWindow), ранние
 * сообщения дорисовываются при прокрутке к верху. Новые сообщения появляются с анимацией, лента держится
 * у низа: первый раз — мгновенно, дальше — плавно.
 */
export const ChatFeed = forwardRef<ChatFeedHandle, ChatFeedProps>(function ChatFeed(
  { chatId, messages, loading, error, streamingText, renderMessage },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Первая прокрутка к низу (открытие чата) — мгновенная, без видимой долгой прокрутки от верха.
  const didInitialScroll = useRef(false);
  // Сообщения, чьё появление уже отыграло. Анимируем только новые: иначе перемонтирование хвоста
  // (смена ветки, правка) на длинной истории упиралось бы в задержку каскада по индексу.
  const animatedIds = useRef<Set<number>>(new Set());

  useImperativeHandle(ref, () => ({
    markAnimated: (id) => {
      animatedIds.current.add(id);
    },
  }));

  useEffect(() => {
    if (!messages.length) return;
    endRef.current?.scrollIntoView({ behavior: didInitialScroll.current ? "smooth" : "auto" });
    didInitialScroll.current = true;
  }, [messages.length, streamingText]);

  // После коммита все текущие сообщения считаются показанными — новыми будут только добавленные позже.
  useEffect(() => {
    for (const m of messages) animatedIds.current.add(m.id);
  }, [messages]);

  const renderWindow = useRenderWindow(scrollRef, messages.length, chatId);
  // Каскад отсчитываем от первого нового сообщения — новые появляются быстро при любой длине истории.
  const firstNewIdx = messages.findIndex((m) => !animatedIds.current.has(m.id));

  return (
    <div ref={scrollRef} className={styles.feed}>
      {loading ? (
        <div className={styles.center}>
          <Loader />
        </div>
      ) : error ? (
        <div className={styles.center}>
          <EmptyState icon={MessagesSquare} title="Не удалось загрузить чат" description="Проверьте соединение и откройте чат снова." />
        </div>
      ) : messages.length === 0 && streamingText === null ? (
        <div className={styles.center}>
          <EmptyState icon={MessageCircle} title="Напишите первое сообщение" description="Или нажмите ✦ — ИИ начнёт сам." />
        </div>
      ) : (
        <div className={styles.inner}>
          <InfiniteSentinel hasMore={renderWindow.hasMore} loading={false} onLoadMore={renderWindow.loadMore} />
          {messages.slice(renderWindow.start).map((msg, offset) => {
            const i = renderWindow.start + offset;
            const isNew = firstNewIdx >= 0 && !animatedIds.current.has(msg.id);
            const delay = isNew ? Math.min((i - firstNewIdx) * STAGGER_S, STAGGER_MAX_S) : 0;
            return (
              <motion.div
                key={msg.id}
                initial={isNew ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...MOTION_TRANSITION, delay }}
              >
                {renderMessage(msg)}
              </motion.div>
            );
          })}
          {/* Без exit-анимации: потоковый пузырь исчезает в том же коммите, где в ленту влит готовый
              ответ (commit в useSendMessage), — кросс-фейд одинакового текста давал мелькание. */}
          {streamingText !== null && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={MOTION_TRANSITION}>
              <StreamingBubble text={streamingText} />
            </motion.div>
          )}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
});
