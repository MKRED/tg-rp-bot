import { Button, Caption, Cell, Section } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { ApiError } from "../../../../shared/api/client";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SectionActions } from "../../../../shared/components/SectionActions";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { useToast } from "../../../../shared/toast";
import { answerCardBlockQuestions, generateCardBlock } from "../../api/cards-api";
import type { CardCategory } from "../../types/card";
import { AskUserQuestionsCarousel } from "./AskUserQuestionsCarousel";

const ERROR_MESSAGES: Record<string, string> = {
  preset_required: "Сначала выберите пресет ИИ для генерации",
  nothing_to_generate: "Все включённые блоки уже сгенерированы",
  target_not_found: "Этот блок больше не актуален — обновите карточку",
  busy: "Генерация уже идёт, подождите",
  not_found: "Карточка не найдена",
  no_pending_question: "Вопрос уже неактуален — сгенерируйте блок заново",
  answers_mismatch: "Не удалось отправить ответы — попробуйте сгенерировать блок заново",
};

interface GenerationSectionProps {
  /** undefined — карточка ещё не сохранена (генерация недоступна, роут требует существующий id). */
  cardId: number | undefined;
  categories: CardCategory[];
  presetId: number | null;
  /**
   * Есть ли несохранённые правки формы (имя/промпт/структура/пресет). Генерация читает prompt и
   * categories с сервера (последнюю СОХРАНЁННУЮ версию), поэтому при isDirty результат разошёлся бы
   * с тем, что видно в форме — при клике на любую кнопку сперва предупреждаем и сохраняем через
   * onSaveBeforeGenerate, а не тихо генерируем по устаревшим данным.
   */
  formDirty: boolean;
  /** Сохраняет форму (тот же путь, что кнопка «Сохранить») — true при успехе. */
  onSaveBeforeGenerate: () => Promise<boolean>;
  /** Ручная правка content — часть «грязного» состояния формы (требует «Сохранить»). Используется
   * и для локального обновления pendingQuestions категории (ask_user) — это НЕ грязная правка
   * формы, normalizeCardDraft эти поля из сравнения исключает (см. lib/formDirty.ts). */
  onContentChange: (categories: CardCategory[]) => void;
  /** Результат генерации уже сохранён на сервере — родитель синхронизирует и стейт, и baseline. */
  onGenerated: (categoryId: string, content: string) => void;
}

/**
 * Блоки структуры карточки с результатом генерации: content каждого enabled-блока редактируется
 * вручную (PromptEditorField). Кнопка под конкретным блоком зависит от его позиции относительно
 * первого ещё не заполненного enabled-блока: у блоков ВЫШЕ него (уже сгенерированы) —
 * «Перегенерировать» с подтверждением, у самого первого незаполненного — «Сгенерировать» (обычный
 * шаг очереди), у блоков ниже (очередь до них ещё не дошла) — кнопки нет. Перегенерация запрашивает
 * тот же блок явным categoryId — как если бы мы снова шли по очереди и дошли до него (контекст —
 * блоки строго до него, см. assembleCardBlockPrompt на сервере).
 *
 * Уточняющие вопросы (ask_user, см. askUserTool.ts на сервере) — если модель попросила уточнение
 * перед генерацией блока, вместо его PromptEditorField+кнопки рендерится AskUserQuestionsCarousel:
 * вопросы и ответы хранятся прямо на категории (category.pendingQuestions/askUserAnswers — приходят
 * с сервера в самой карточке), а не в стейте этого компонента — ограничения по времени на ответ нет,
 * состояние переживает reload/новую сессию так же, как обычный незаполненный блок.
 *
 * Несохранённые правки формы (formDirty) больше не прячут кнопки — вместо этого клик по любой
 * кнопке при formDirty сперва предупреждает, что карточка будет сохранена, и только после
 * успешного onSaveBeforeGenerate запускает сам запрос генерации (см. handleClick).
 */
export function GenerationSection({
  cardId,
  categories,
  presetId,
  formDirty,
  onSaveBeforeGenerate,
  onContentChange,
  onGenerated,
}: GenerationSectionProps) {
  const { showToast } = useToast();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);

  const enabled = categories.filter((c) => c.enabled);
  const nextIndex = enabled.findIndex((c) => c.content.trim() === "");
  // Пока хоть один блок ждёт ответа на ask_user, очередь генерации дальше не двигаем — это не
  // сетевая активность (generatingId может быть null после reload), а самостоятельное состояние.
  // Только по enabled: карусель рендерится ниже тоже внутри enabled.map — если категорию с
  // зависшими pendingQuestions выключили в структуре, для неё карусель больше нигде не рисуется
  // (недостижима), и проверка по ВСЕМ categories держала бы buttonsDisabled=true навсегда, блокируя
  // все кнопки «Сгенерировать»/«Перегенерировать» без пути к восстановлению.
  const hasPendingQuestions = enabled.some((c) => (c.pendingQuestions?.length ?? 0) > 0);

  const updateContent = (id: string, content: string) => {
    onContentChange(categories.map((c) => (c.id === id ? { ...c, content } : c)));
  };

  const setCategoryPendingQuestions = (categoryId: string, questions: CardCategory["pendingQuestions"]) => {
    onContentChange(categories.map((c) => (c.id === categoryId ? { ...c, pendingQuestions: questions } : c)));
  };

  /**
   * id — cardId, уже сужен вызывающим (handleClick) до number, чтобы ранний выход по undefined
   * не мог случиться ПОСЛЕ setGeneratingId — иначе finally не выполнился бы и кнопки остались бы
   * задизейбленными навсегда. categoryId — что слать серверу: для «Сгенерировать» (следующий
   * пустой) НЕ передаём — цель выбирает сервер по сохранённой карточке (server-authoritative):
   * локальный nextIndex мог устареть, если карточку меняли из другой сессии, а результат мержится
   * по id из ответа (onGenerated), так что расхождение не ломает мердж. Для «Перегенерировать»
   * categoryId передаём явно — это и есть цель действия.
   */
  const runGenerate = async (id: number, categoryId?: string) => {
    try {
      const result = await generateCardBlock(id, categoryId);
      if (result.status === "questions") {
        setCategoryPendingQuestions(result.categoryId, result.questions);
        return; // generatingId остаётся — блок ждёт ответа в карусели, не финальной ошибки/успеха
      }
      onGenerated(result.categoryId, result.content);
      setGeneratingId(null);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : "";
      showToast({ type: "error", message: ERROR_MESSAGES[code] ?? (code || "Не удалось сгенерировать блок") });
      setGeneratingId(null);
    }
  };

  /** Общий хвост для «Ответить» и «Пропустить все вопросы» карусели — запускает генерацию блока
   * заново с уже известными ответами в контексте (см. answerCardBlockQuestions на сервере). */
  const respondToQuestions = async (
    categoryId: string,
    input: { skipped: true } | { skipped: false; answers: string[] },
  ) => {
    if (cardId === undefined) return;
    setAnswering(true);
    try {
      const result = await answerCardBlockQuestions(cardId, categoryId, input);
      if (result.status === "questions") {
        setCategoryPendingQuestions(result.categoryId, result.questions); // новый раунд уточнений
        return;
      }
      onGenerated(result.categoryId, result.content);
      setGeneratingId(null);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : "";
      showToast({ type: "error", message: ERROR_MESSAGES[code] ?? (code || "Не удалось сгенерировать блок") });
      // Вопрос мог устареть (другая вкладка уже ответила/сгенерировала) — не оставляем карусель
      // висеть в заведомо тупиковом состоянии, пользователь начнёт заново кнопкой «Сгенерировать».
      setCategoryPendingQuestions(categoryId, undefined);
      setGeneratingId(null);
    } finally {
      setAnswering(false);
    }
  };

  /**
   * Клик по кнопке блока. При formDirty — одно предупреждение «сохраним и сгенерируем» вместо
   * двух отдельных диалогов подряд (оно же покрывает предупреждение о перезаписи для regenerate);
   * при отказе или проваленном сохранении (включая невалидную форму — canSubmit внутри save()) —
   * тост и генерация не запускается, тишины после подтверждённого диалога быть не должно. Без
   * несохранённых правок — прежнее поведение: у regenerate свой explicit-confirm «перезапишет
   * текст», у generate — без подтверждения.
   */
  const handleClick = async (category: CardCategory, isRegenerate: boolean) => {
    if (cardId === undefined) return;

    if (formDirty) {
      const message = isRegenerate
        ? `Есть несохранённые изменения формы — карточка будет сохранена, а текущий текст блока «${category.title || "…"}» будет заменён новым результатом генерации.`
        : "Есть несохранённые изменения формы — карточка будет сохранена, после чего запустится генерация.";
      const confirmed = await confirmAction(message, {
        title: "Сохранить и сгенерировать?",
        confirmText: "Сохранить и сгенерировать",
      });
      if (!confirmed) return;
      setGeneratingId(category.id);
      const saved = await onSaveBeforeGenerate();
      if (!saved) {
        setGeneratingId(null);
        showToast({ type: "error", message: "Не удалось сохранить карточку" });
        return;
      }
      await runGenerate(cardId, isRegenerate ? category.id : undefined);
      return;
    }

    if (isRegenerate) {
      const confirmed = await confirmAction(
        `Текущий текст блока «${category.title || "…"}» будет заменён новым результатом генерации.`,
        { title: "Перегенерировать блок?", confirmText: "Перегенерировать" },
      );
      if (!confirmed) return;
    }
    setGeneratingId(category.id);
    await runGenerate(cardId, isRegenerate ? category.id : undefined);
  };

  if (enabled.length === 0) {
    return <Cell subtitle="Включите хотя бы одну категорию в структуре, чтобы начать генерацию">Нет категорий для генерации</Cell>;
  }

  // formDirty сюда сознательно не входит — кнопки остаются видимыми, предупреждение и сохранение
  // происходят внутри handleClick при самом клике (см. JSDoc компонента).
  const canAct = cardId !== undefined && presetId !== null;
  const buttonsDisabled = generatingId !== null || hasPendingQuestions;

  return (
    <>
      <Section className="section-blend-inputs">
        {enabled.map((category, index) => {
          const isRegenerate = nextIndex === -1 || index < nextIndex;
          const isNext = index === nextIndex;
          const pendingQuestions = category.pendingQuestions;

          if (pendingQuestions && pendingQuestions.length > 0) {
            return (
              <AskUserQuestionsCarousel
                key={category.id}
                categoryTitle={category.title || "…"}
                questions={pendingQuestions}
                submitting={answering}
                onSubmit={(answers) => void respondToQuestions(category.id, { skipped: false, answers })}
                onSkipAll={() => void respondToQuestions(category.id, { skipped: true })}
              />
            );
          }

          return (
            <div key={category.id}>
              <PromptEditorField
                header={category.title || "Без названия"}
                placeholder="Ещё не сгенерирован…"
                value={category.content}
                previewLines={4}
                onChange={(value) => updateContent(category.id, value)}
              />
              {canAct && (isRegenerate || isNext) && (
                <div className="card-generation__block-action">
                  {isRegenerate ? (
                    <Button
                      size="s"
                      mode="outline"
                      loading={generatingId === category.id}
                      disabled={buttonsDisabled}
                      onClick={() => handleClick(category, true)}
                    >
                      Перегенерировать
                    </Button>
                  ) : (
                    <Button
                      size="l"
                      stretched
                      loading={generatingId === category.id}
                      disabled={buttonsDisabled}
                      onClick={() => handleClick(category, false)}
                    >
                      {`Сгенерировать блок «${category.title || "…"}»`}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {!canAct && (
        <SectionActions>
          <Caption level="1" className="card-generation__hint">
            {cardId === undefined ? "Сначала сохраните карточку" : "Выберите пресет ИИ, чтобы включить генерацию"}
          </Caption>
        </SectionActions>
      )}
    </>
  );
}
