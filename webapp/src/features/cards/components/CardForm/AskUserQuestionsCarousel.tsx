import { Badge, Button, Group, Paper, Stack, Text, Textarea } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import type { AskUserQuestion } from "../../types/card";
import styles from "./AskUserQuestionsCarousel.module.css";

interface AskUserQuestionsCarouselProps {
  categoryTitle: string;
  questions: AskUserQuestion[];
  submitting: boolean;
  onSubmit: (answers: string[]) => void;
  onSkipAll: () => void;
}

/**
 * Карусель уточняющих вопросов ask_user — встаёт вместо блока, который модель попросила уточнить
 * перед генерацией: один вопрос за раз, «Назад»/«Далее», на последнем — «Ответить». Вопросы и
 * накопленные ответы хранятся на самой категории на сервере — можно свернуть Mini App и вернуться
 * позже, карточка при этом не занята.
 */
export function AskUserQuestionsCarousel({
  categoryTitle,
  questions,
  submitting,
  onSubmit,
  onSkipAll,
}: AskUserQuestionsCarouselProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));

  // Новый набор вопросов (следующий раунд ask_user после ответа) — сбрасываем прогресс и черновик
  // ответов, а не продолжаем со старого step/answers чужой длины.
  useEffect(() => {
    setStep(0);
    setAnswers(questions.map(() => ""));
  }, [questions]);

  const question = questions[step];
  if (!question) return null;
  const isLast = step === questions.length - 1;
  const answer = answers[step] ?? "";

  const setAnswer = (value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === step ? value : a)));
  };

  /** Вариант-подсказка не затирает уже введённый текст — дописывается через запятую. */
  const applyOption = (option: string) => {
    setAnswers((prev) =>
      prev.map((a, i) => {
        if (i !== step) return a;
        if (!a.trim()) return option;
        return a.includes(option) ? a : `${a}, ${option}`;
      }),
    );
  };

  const canGoNext = answer.trim().length > 0 && !submitting;

  return (
    <Paper className={styles.root}>
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap">
          <MessageCircleQuestion size={18} className={styles.icon} aria-hidden />
          <Text fw={600} className={styles.title}>{`Уточнение — «${categoryTitle}»`}</Text>
          <Badge variant="light" className={styles.badge}>{`${step + 1} из ${questions.length}`}</Badge>
        </Group>

        {/* Смена вопроса — короткий сдвиг: видно, что это следующий шаг, а не тот же вопрос. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={MOTION_TRANSITION}
          >
            <Stack gap="sm">
              <Text fw={500}>{question.question}</Text>
              {question.options && question.options.length > 0 && (
                <Group gap="xs">
                  {question.options.map((option) => (
                    <Button key={option} variant="default" size="compact-md" onClick={() => applyOption(option)}>
                      {option}
                    </Button>
                  ))}
                </Group>
              )}
              <Textarea
                autosize
                minRows={3}
                placeholder="Ваш ответ…"
                aria-label="Ответ"
                value={answer}
                onChange={(e) => setAnswer(e.currentTarget.value)}
              />
            </Stack>
          </motion.div>
        </AnimatePresence>

        <Group gap="sm" wrap="nowrap">
          <Button variant="default" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}>
            Назад
          </Button>
          <Button
            className={styles.next}
            loading={submitting}
            disabled={!canGoNext}
            onClick={() => (isLast ? onSubmit(answers) : setStep((s) => s + 1))}
          >
            {isLast ? "Ответить" : "Далее"}
          </Button>
        </Group>
        <Button variant="subtle" disabled={submitting} onClick={onSkipAll}>
          Пропустить все вопросы
        </Button>
      </Stack>
    </Paper>
  );
}
