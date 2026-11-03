import { Stack, Text } from "@mantine/core";
import { MessageCircleQuestion } from "lucide-react";
import type { AskUserQuestion } from "@tg-rp-bot/shared";
import styles from "./CoauthorFeed.module.css";

interface AnsweredQuestionsProps {
  questions: AskUserQuestion[];
  answers: string[];
  skipped?: boolean;
}

/** Уже отвеченные вопросы ИИ — компактно, вопрос и ответ под ним. */
export function AnsweredQuestions({ questions, answers, skipped }: AnsweredQuestionsProps) {
  return (
    <div className={styles.answered}>
      <Stack gap={8}>
        <Text size="xs" c="dimmed" className={styles.answeredTitle}>
          <MessageCircleQuestion size={14} aria-hidden />
          {skipped ? "Вопросы ИИ — пропущены" : "Вопросы ИИ"}
        </Text>
        {questions.map((q, i) => (
          <div key={i}>
            <Text size="sm" c="dimmed">
              {q.question}
            </Text>
            <Text size="sm">{answers[i] || "— без ответа"}</Text>
          </div>
        ))}
      </Stack>
    </div>
  );
}
