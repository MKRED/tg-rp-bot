import { Button, Caption, Text, Textarea } from "@telegram-apps/telegram-ui";
import { useEffect, useState } from "react";
import type { AskUserQuestion } from "../../types/card";

interface AskUserQuestionsCarouselProps {
  categoryTitle: string;
  questions: AskUserQuestion[];
  submitting: boolean;
  onSubmit: (answers: string[]) => void;
  onSkipAll: () => void;
}

/**
 * Инлайн-карусель уточняющих вопросов ask_user — рендерится ВМЕСТО блока структуры, который модель
 * попросила уточнить перед генерацией (см. GenerationSection), а не модалкой поверх экрана: один
 * вопрос за раз (шаг карусели), «Назад»/«Далее» листают, на последнем шаге «Далее» становится
 * «Ответить». Вопросы и накопленные ответы хранятся на самой категории на сервере (см.
 * bot/src/db/schema.types.ts) — ограничения по времени на ответ нет: пользователь может свернуть
 * Mini App и вернуться к этому же экрану позже, карточка при этом не считается занятой.
 *
 * Рендерится как top-level child родительской <Section> в GenerationSection (как и обычный блок —
 * <div key={category.id}>…</div>) — БЕЗ собственной вложенной <Section>: у tgui Section свой фон/
 * гуттеры/Divider-логика по top-level children, вложенная Section дала бы задвоенный фон и
 * поломанное разбиение на Divider вместо единого списка блоков.
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

  // Новый набор вопросов (следующий раунд ask_user для того же блока после ответа) — сбрасываем
  // прогресс карусели и черновик ответов, а не продолжаем со старого step/answers чужой длины.
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

  /** Клик по варианту-подсказке: не затирает уже введённый текст — дописывает через запятую. */
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

  const handleNext = () => {
    if (isLast) {
      onSubmit(answers);
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div>
      <Text Component="div" weight="2" className="card-ask-user__title">
        {`Уточнение — «${categoryTitle}»`}
      </Text>

      <div className="card-ask-user__question">
        <Caption level="1" className="card-generation__hint">
          {`Вопрос ${step + 1} из ${questions.length}`}
        </Caption>
        <Text Component="div" weight="2">
          {question.question}
        </Text>
        {question.options && question.options.length > 0 && (
          <div className="card-ask-user__options">
            {question.options.map((option) => (
              <Button key={option} size="s" mode="outline" onClick={() => applyOption(option)}>
                {option}
              </Button>
            ))}
          </div>
        )}
        <Textarea
          rows={3}
          placeholder="Ваш ответ…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>

      <div className="card-generation__block-action card-ask-user__actions">
        <div className="card-ask-user__nav">
          <Button size="m" mode="outline" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}>
            Назад
          </Button>
          <Button size="m" stretched loading={submitting} disabled={!canGoNext} onClick={handleNext}>
            {isLast ? "Ответить" : "Далее"}
          </Button>
        </div>
        <Button size="l" stretched mode="outline" disabled={submitting} onClick={onSkipAll}>
          Пропустить все вопросы
        </Button>
      </div>
    </div>
  );
}
