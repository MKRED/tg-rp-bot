import { ASK_USER_NOTE_MAX_LENGTH } from "@tg-rp-bot/shared";
import { Badge, Button, Group, Paper, Stack, Text, Textarea } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleQuestion, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import type { AskUserQuestion } from "../../types/card";
import styles from "./AskUserQuestionsCarousel.module.css";

interface AskUserQuestionsCarouselProps {
  categoryTitle: string;
  questions: AskUserQuestion[];
  submitting: boolean;
  /** answers — по порядку вопросов, пустая строка — вопрос оставлен без ответа; note — дополнение от себя. */
  onSubmit: (answers: string[], note: string) => void;
  onSkipAll: (note: string) => void;
}

/**
 * Карусель уточняющих вопросов ask_user — встаёт вместо блока, который модель попросила уточнить
 * перед генерацией. Шаги листаются свободно («Назад»/«Далее» и номера шагов), отвечать на всё не
 * обязательно: неотвеченный вопрос уходит модели как отказ. Последний шаг — постоянное «Дополнение»:
 * свободный текст от пользователя по этому блоку, о чём модель не спрашивала. Вопросы хранятся на
 * самой категории на сервере — можно свернуть Mini App и вернуться позже, карточка при этом не занята
 * (черновик ответов живёт только в этом компоненте).
 */
export function AskUserQuestionsCarousel({
  categoryTitle,
  questions,
  submitting,
  onSubmit,
  onSkipAll,
}: AskUserQuestionsCarouselProps) {
  // step === questions.length — шаг «Дополнение».
  const [step, setStep] = useState(0);
  // Направление последнего перехода — чтобы шаг «назад» и выезжал с обратной стороны.
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [note, setNote] = useState("");

  // Новый набор вопросов (следующий раунд ask_user после ответа) — сбрасываем прогресс и черновик
  // ответов, а не продолжаем со старого step/answers чужой длины.
  useEffect(() => {
    setStep(0);
    setDirection(1);
    setAnswers(questions.map(() => ""));
    setNote("");
  }, [questions]);

  if (questions.length === 0) return null;
  const noteStep = questions.length;
  const isNote = step >= noteStep;
  const question = questions[step];
  const answer = answers[step] ?? "";

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

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

  const filled = (index: number) => (index === noteStep ? note : (answers[index] ?? "")).trim().length > 0;
  const hasAnything = answers.some((a) => a.trim()) || note.trim().length > 0;

  return (
    <Paper className={styles.root}>
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap">
          <MessageCircleQuestion size={18} className={styles.icon} aria-hidden />
          <Text fw={600} className={styles.title}>{`Уточнение — «${categoryTitle}»`}</Text>
          <Badge variant="light" className={styles.badge}>
            {isNote ? "Дополнение" : `${step + 1} из ${questions.length}`}
          </Badge>
        </Group>

        {/* Номера шагов: переход к любому вопросу и видно, где ответ уже есть (залитые). */}
        <Group gap="xs">
          {[...questions.keys(), noteStep].map((index) => (
            <Button
              key={index}
              size="compact-sm"
              className={styles.stepButton}
              variant={index === step ? "filled" : filled(index) ? "light" : "default"}
              aria-label={index === noteStep ? "Дополнение" : `Вопрос ${index + 1}`}
              aria-current={index === step ? "step" : undefined}
              disabled={submitting}
              onClick={() => goTo(index)}
            >
              {index === noteStep ? <PenLine size={14} aria-hidden /> : index + 1}
            </Button>
          ))}
        </Group>

        {/* Смена шага — короткий сдвиг в сторону перехода: видно, что это другой шаг. */}
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ opacity: 0, x: 12 * dir }),
              center: { opacity: 1, x: 0 },
              exit: (dir: number) => ({ opacity: 0, x: -12 * dir }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={MOTION_TRANSITION}
          >
            {isNote || !question ? (
              <Stack gap="sm">
                <Text fw={500}>Хотите что-то добавить от себя?</Text>
                <Text size="sm" c="dimmed">
                  Необязательно. Любые пожелания по этому блоку, о которых ИИ не спросил.
                </Text>
                <Textarea
                  autosize
                  minRows={3}
                  maxLength={ASK_USER_NOTE_MAX_LENGTH}
                  placeholder="Например: сделай акцент на…"
                  aria-label="Дополнение"
                  value={note}
                  onChange={(e) => setNote(e.currentTarget.value)}
                />
              </Stack>
            ) : (
              <Stack gap="sm">
                <Text fw={500}>{question.question}</Text>
                {question.options && question.options.length > 0 && (
                  <Group gap="xs">
                    {question.options.map((option) => (
                      <Button
                        key={option}
                        variant="default"
                        size="compact-md"
                        classNames={{ root: styles.option, label: styles.optionLabel }}
                        onClick={() => applyOption(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </Group>
                )}
                <Textarea
                  autosize
                  minRows={3}
                  placeholder="Ваш ответ… (можно оставить пустым)"
                  aria-label="Ответ"
                  value={answer}
                  onChange={(e) => setAnswer(e.currentTarget.value)}
                />
              </Stack>
            )}
          </motion.div>
        </AnimatePresence>

        <Group gap="sm" grow>
          <Button variant="default" disabled={step === 0 || submitting} onClick={() => goTo(step - 1)}>
            Назад
          </Button>
          <Button variant="default" disabled={isNote || submitting} onClick={() => goTo(step + 1)}>
            Далее
          </Button>
        </Group>
        {/* Отправка доступна с любого шага — не нужно пролистывать всё, чтобы ответить на один вопрос.
            Пустая отправка — то же, что «Пропустить», поэтому до первого ввода кнопка выключена. */}
        <Button loading={submitting} disabled={!hasAnything} onClick={() => onSubmit(answers, note)}>
          Ответить
        </Button>
        <Button variant="subtle" disabled={submitting} onClick={() => onSkipAll(note)}>
          Пропустить все вопросы
        </Button>
      </Stack>
    </Paper>
  );
}
