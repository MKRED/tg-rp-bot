import { Button, Caption, Cell, Section } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { ApiError } from "../../../../shared/api/client";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SectionActions } from "../../../../shared/components/SectionActions";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { useToast } from "../../../../shared/toast";
import { generateCardBlock } from "../../api/cards-api";
import type { CardCategory } from "../../types/card";

const ERROR_MESSAGES: Record<string, string> = {
  preset_required: "Сначала выберите пресет ИИ для генерации",
  nothing_to_generate: "Все включённые блоки уже сгенерированы",
  target_not_found: "Этот блок больше не актуален — обновите карточку",
  busy: "Генерация уже идёт, подождите",
  not_found: "Карточка не найдена",
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
  /** Ручная правка content — часть «грязного» состояния формы (требует «Сохранить»). */
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

  const enabled = categories.filter((c) => c.enabled);
  const nextIndex = enabled.findIndex((c) => c.content.trim() === "");

  const updateContent = (id: string, content: string) => {
    onContentChange(categories.map((c) => (c.id === id ? { ...c, content } : c)));
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
      onGenerated(result.categoryId, result.content);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : "";
      showToast({ type: "error", message: ERROR_MESSAGES[code] ?? (code || "Не удалось сгенерировать блок") });
    } finally {
      setGeneratingId(null);
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

  return (
    <>
      <Section className="section-blend-inputs">
        {enabled.map((category, index) => {
          const isRegenerate = nextIndex === -1 || index < nextIndex;
          const isNext = index === nextIndex;
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
                      disabled={generatingId !== null}
                      onClick={() => handleClick(category, true)}
                    >
                      Перегенерировать
                    </Button>
                  ) : (
                    <Button
                      size="l"
                      stretched
                      loading={generatingId === category.id}
                      disabled={generatingId !== null}
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
