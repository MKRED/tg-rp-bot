import { Loader, Text } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { AskUserQuestionsCarousel } from "../../../../shared/components/AskUserQuestionsCarousel";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import { liveShowsActivity, type LiveItem } from "../../lib/liveTurn";
import type { CoauthorAnswerInput, CoauthorChat } from "../../types/coauthor";
import { AnsweredQuestions } from "./AnsweredQuestions";
import { EditsChip } from "./EditsChip";
import { EmptyChat } from "./EmptyChat";
import { FeedText } from "./FeedText";
import { StepsList } from "./StepsList";
import { TurnSteps } from "./TurnSteps";
import styles from "./CoauthorFeed.module.css";

interface CoauthorFeedProps {
  chat: CoauthorChat;
  /** Отправленное сообщение, на которое ещё нет ответа. */
  sendingText: string | null;
  /** Шаги и текст своего идущего хода, по мере прихода из потока. */
  live: LiveItem[];
  /** ИИ сейчас работает (своя отправка, ответ на вопросы или ход, начатый до обновления страницы). */
  thinking: boolean;
  answering: boolean;
  onAnswer: (input: CoauthorAnswerInput) => void;
  onOpenCard: (cardId: number) => void;
  onSuggest: (text: string) => void;
}

/** Лента чата соавтора — единственное, что здесь прокручивается. Держится у низа при новых сообщениях. */
export function CoauthorFeed({ chat, sendingText, live, thinking, answering, onAnswer, onOpenCard, onSuggest }: CoauthorFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  // Каждое слагаемое — отдельно: ответ ИИ приходит в том же коммите, где пропадают отправленное
  // сообщение и индикатор, и их сумма может не измениться.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [chat.feed.length, sendingText, thinking]);

  // Страница обновлена посреди хода: потока нет, шаги приходят опросом.
  const items: LiveItem[] = live.length > 0 ? live : chat.liveSteps?.length ? [{ type: "steps", steps: chat.liveSteps }] : [];
  // Текст приходит часто: плавная прокрутка на каждый кусок дёргалась бы.
  const liveSize = items.reduce((sum, item) => sum + (item.type === "text" ? item.text.length : item.steps.length), 0);
  useEffect(() => {
    if (liveSize > 0) endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [liveSize]);

  if (chat.feed.length === 0 && !sendingText && !thinking) {
    return (
      <div className={styles.feed}>
        <EmptyChat chat={chat} onSuggest={onSuggest} />
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      <div className={styles.inner}>
        {chat.feed.map((item, i) => {
          let node;
          switch (item.kind) {
            case "user":
              node = <div className={styles.user}>{item.text}</div>;
              break;
            case "assistant":
              node = (
                <div className={styles.assistant}>
                  <FeedText text={item.text} />
                </div>
              );
              break;
            case "steps":
              node = <TurnSteps steps={item.steps} cards={chat.cards} />;
              break;
            case "edits":
              node = <EditsChip chat={chat} proposalIds={item.proposalIds} onOpen={onOpenCard} />;
              break;
            case "questions":
              node =
                item.answers === null ? (
                  <AskUserQuestionsCarousel
                    title={item.questions.length > 1 ? "Вопросы ИИ" : "Вопрос ИИ"}
                    questions={item.questions}
                    submitting={answering}
                    onSubmit={(answers, note) => onAnswer({ skipped: false, answers, note })}
                    onSkipAll={(note) => onAnswer({ skipped: true, note })}
                  />
                ) : (
                  <AnsweredQuestions questions={item.questions} answers={item.answers} skipped={item.skipped} />
                );
              break;
          }
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={MOTION_TRANSITION}>
              {node}
            </motion.div>
          );
        })}
        {sendingText && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={MOTION_TRANSITION}>
            <div className={styles.user}>{sendingText}</div>
          </motion.div>
        )}
        {items.map((item, i) =>
          item.type === "text" ? (
            <div key={i} className={styles.assistant}>
              <FeedText text={item.text} />
            </div>
          ) : (
            <StepsList key={i} steps={item.steps} cards={chat.cards} />
          ),
        )}
        {thinking && !liveShowsActivity(items) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION_TRANSITION}>
            <div className={styles.thinking} role="status">
              <Loader type="dots" size="sm" />
              <Text size="sm" c="dimmed">
                Думает…
              </Text>
            </div>
          </motion.div>
        )}
      </div>
      <div ref={endRef} />
    </div>
  );
}
