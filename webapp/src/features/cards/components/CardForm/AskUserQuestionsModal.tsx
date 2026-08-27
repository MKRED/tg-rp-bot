import { Button, Modal, Section, Text, Textarea } from "@telegram-apps/telegram-ui";
import { useEffect, useRef, useState } from "react";
import { SectionActions } from "../../../../shared/components/SectionActions";
import type { AskUserQuestion } from "../../types/card";

interface AskUserQuestionsModalProps {
  open: boolean;
  questions: AskUserQuestion[];
  submitting: boolean;
  onSubmit: (answers: string[]) => void;
  onSkip: () => void;
}

/**
 * Модалка уточняющих вопросов от модели (ask_user, см. GenerationSection): один вызов инструмента
 * приносит сразу пачку вопросов (см. askUserTool.ts на сервере — модель обязана батчить их в один
 * вызов), здесь все они отвечаются за один раз. Вариант-подсказка — маленькая кнопка, подставляющая
 * свой текст в поле ответа (его всё равно можно отредактировать перед отправкой), а не радио-выбор —
 * ответ всегда остаётся свободным текстом. Закрытие модалки свайпом/тапом мимо равносильно
 * «Пропустить» (onOpenChange(false)) — молчаливой потери вопросов без ответа модели быть не должно
 * (иначе карточка осталась бы залоченной до TTL, см. cardLock.ts).
 *
 * tgui Modal (vaul Drawer) вызывает onOpenChange(false) не только на пользовательский жест, но и
 * ПРОГРАММНО — когда проп open меняется на false (см. GenerationSection: setPendingQuestions(null)
 * после успешного ответа). Без resolvedRef успешное «Ответить»/«Пропустить» приводило бы к ВТОРОМУ
 * onSkip() сразу вслед за первым запросом — сервер уже снял pending, второй запрос 404-ился бы
 * "no_pending_question", и пользователь увидел бы ложный тост поверх только что принятого ответа.
 * dismissible={!submitting} — тот же повод не даёт закрыть модалку свайпом, пока ответ в полёте
 * (иначе можно было бы отправить два параллельных POST /generate/answer).
 */
export function AskUserQuestionsModal({ open, questions, submitting, onSubmit, onSkip }: AskUserQuestionsModalProps) {
  const [answers, setAnswers] = useState<string[]>([]);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setAnswers(questions.map(() => ""));
      resolvedRef.current = false;
    }
  }, [open, questions]);

  const setAnswer = (index: number, value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  /** Клик по варианту-подсказке: не затирает уже введённый текст — дописывает через запятую. */
  const applyOption = (index: number, option: string) => {
    setAnswers((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        if (!a.trim()) return option;
        return a.includes(option) ? a : `${a}, ${option}`;
      }),
    );
  };

  const canSubmit = !submitting && answers.length > 0 && answers.every((a) => a.trim().length > 0);

  const handleSubmit = () => {
    resolvedRef.current = true;
    onSubmit(answers);
  };

  const handleSkip = () => {
    resolvedRef.current = true;
    onSkip();
  };

  return (
    <Modal
      open={open}
      dismissible={!submitting}
      onOpenChange={(next) => {
        // next: true — открытие, игнорируем; resolvedRef — уже ответили/пропустили явно кнопкой
        // (см. докблок компонента), второй onSkip() не нужен — это тот же программный close.
        if (next || resolvedRef.current) return;
        resolvedRef.current = true;
        onSkip();
      }}
      header={<Modal.Header>Уточнение от ИИ</Modal.Header>}
    >
      <Section footer="Прежде чем сгенерировать блок, модель попросила уточнить несколько деталей.">
        {questions.map((q, index) => (
          <div key={index} className="card-ask-user__question">
            <Text Component="div" weight="2">
              {q.question}
            </Text>
            {q.options && q.options.length > 0 && (
              <div className="card-ask-user__options">
                {q.options.map((option) => (
                  <Button key={option} size="s" mode="outline" onClick={() => applyOption(index, option)}>
                    {option}
                  </Button>
                ))}
              </div>
            )}
            <Textarea
              rows={2}
              placeholder="Ваш ответ…"
              value={answers[index] ?? ""}
              onChange={(e) => setAnswer(index, e.target.value)}
            />
          </div>
        ))}
      </Section>

      <SectionActions>
        <Button size="l" stretched loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
          Ответить
        </Button>
        <Button size="l" stretched mode="outline" disabled={submitting} onClick={handleSkip}>
          Пропустить
        </Button>
      </SectionActions>
    </Modal>
  );
}
