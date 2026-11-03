import { Loader, Text } from "@mantine/core";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { AskUserQuestionsCarousel } from "../../../../shared/components/AskUserQuestionsCarousel";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import type { CoauthorAnswerInput, CoauthorChat } from "../../types/coauthor";
import { AnsweredQuestions } from "./AnsweredQuestions";
import { EditsChip } from "./EditsChip";
import { EmptyChat } from "./EmptyChat";
import { FeedText } from "./FeedText";
import styles from "./CoauthorFeed.module.css";

interface CoauthorFeedProps {
  chat: CoauthorChat;
  /** Отправленное сообщение, на которое ещё нет ответа. */
  sendingText: string | null;
  /** ИИ сейчас работает (своя отправка, ответ на вопросы или ход, начатый до обновления страницы). */
  thinking: boolean;
  answering: boolean;
  onAnswer: (input: CoauthorAnswerInput) => void;
  onOpenCard: (cardId: number) => void;
  onSuggest: (text: string) => void;
}

/** Лента чата соавтора — единственное, что здесь прокручивается. Держится у низа при новых сообщениях. */
export function CoauthorFeed({ chat, sendingText, thinking, answering, onAnswer, onOpenCard, onSuggest }: CoauthorFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  // Каждое слагаемое — отдельно: ответ ИИ приходит в том же коммите, где пропадают отправленное
  // сообщение и индикатор, и их сумма может не измениться.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [chat.feed.length, sendingText, thinking]);

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
        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION_TRANSITION}>
            <div className={styles.thinking} role="status">
              <Loader type="dots" size="sm" />
              <Text size="sm" c="dimmed">
                ИИ работает над карточками…
              </Text>
            </div>
          </motion.div>
        )}
      </div>
      <div ref={endRef} />
    </div>
  );
}
