import type { AnswerCardQuestionsInput } from "@tg-rp-bot/shared";
import { useState } from "react";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { useToast } from "../../../../shared/toast";
import { answerCardBlockQuestions, generateCardBlock } from "../../api/cards-api";
import { generationErrorMessage } from "../../lib/generationErrors";
import type { CardCategory } from "../../types/card";
import { useGenerationResume } from "./useGenerationResume";

interface UseCardGenerationArgs {
  /** undefined — карточка ещё не сохранена (роут генерации требует существующий id). */
  cardId: number | undefined;
  /** Блоки формы — названия для уведомлений о генерации, подхваченной после обновления страницы. */
  categories: CardCategory[];
  /**
   * Есть ли несохранённые правки формы. Генерация читает prompt и categories с сервера (последнюю
   * СОХРАНЁННУЮ версию), поэтому при правках результат разошёлся бы с формой — перед запросом
   * предупреждаем и сохраняем через saveForm, а не тихо генерируем по устаревшим данным.
   */
  formDirty: boolean;
  /** Сохраняет форму (тот же путь, что «Сохранить») — true при успехе. */
  saveForm: () => Promise<boolean>;
  /**
   * Точечно ставит вопросы ask_user категории (не «грязная» правка формы). Функциональным апдейтом в
   * форме: ответ сервера приходит через секунды-минуты, и массив, замкнутый на момент клика, затёр бы
   * правки других блоков, сделанные за это время. toolContextTokens — свежий вес контекста
   * инструментов блока из ответа сервера; undefined (сброс карусели после ошибки) — не трогаем.
   */
  onPendingQuestions: (
    categoryId: string,
    questions: CardCategory["pendingQuestions"],
    toolContextTokens?: number,
  ) => void;
  /** Результат генерации уже сохранён на сервере — форма синхронизирует и стейт, и baseline. */
  onGenerated: (categoryId: string, content: string, toolContextTokens: number) => void;
}

/**
 * Запросы генерации блоков карточки: «Сгенерировать» следующий пустой блок, «Перегенерировать»
 * готовый, ответы на уточняющие вопросы ask_user. Вопросы и ответы хранятся на самой категории
 * (приходят с сервера в карточке) — у ответа нет ограничения по времени, состояние переживает reload.
 */
export function useCardGeneration({
  cardId,
  categories,
  formDirty,
  saveForm,
  onPendingQuestions,
  onGenerated,
}: UseCardGenerationArgs) {
  const { showToast } = useToast();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  // Какая из двух кнопок блока запустила генерацию — только чтобы крутить индикатор на нажатой.
  const [generatingForced, setGeneratingForced] = useState(false);
  const [answering, setAnswering] = useState(false);
  useGenerationResume({ cardId, categories, setGeneratingId, onPendingQuestions, onGenerated });

  /**
   * id уже сужен вызывающим до number — ранний выход по undefined после setGeneratingId оставил бы
   * кнопки выключенными навсегда. categoryId для «Сгенерировать» не передаём — цель выбирает сервер
   * по сохранённой карточке (локальная очередь могла устареть, если карточку меняли из другой сессии;
   * результат мержится по id из ответа). Для «Перегенерировать» цель — явно этот блок.
   */
  const runGenerate = async (id: number, categoryId: string | undefined, forceAskUser: boolean) => {
    try {
      const result = await generateCardBlock(id, { categoryId, ...(forceAskUser && { forceAskUser }) });
      if (result.status === "questions") {
        onPendingQuestions(result.categoryId, result.questions, result.toolContextTokens);
        return; // generatingId остаётся — блок ждёт ответа в карусели
      }
      onGenerated(result.categoryId, result.content, result.toolContextTokens);
      setGeneratingId(null);
    } catch (err) {
      showToast({ type: "error", message: generationErrorMessage(err) });
      setGeneratingId(null);
    }
  };

  /** «Ответить» и «Пропустить все вопросы» — генерация блока заново с ответами в контексте. */
  const respond = async (categoryId: string, input: AnswerCardQuestionsInput) => {
    if (cardId === undefined) return;
    setAnswering(true);
    try {
      const result = await answerCardBlockQuestions(cardId, categoryId, input);
      if (result.status === "questions") {
        onPendingQuestions(result.categoryId, result.questions, result.toolContextTokens); // новый раунд уточнений
        return;
      }
      onGenerated(result.categoryId, result.content, result.toolContextTokens);
      setGeneratingId(null);
    } catch (err) {
      showToast({ type: "error", message: generationErrorMessage(err) });
      // Вопрос мог устареть (другая вкладка уже ответила) — не оставляем карусель в тупике,
      // пользователь начнёт заново кнопкой «Сгенерировать».
      onPendingQuestions(categoryId, undefined);
      setGeneratingId(null);
    } finally {
      setAnswering(false);
    }
  };

  /**
   * Кнопка блока. При несохранённых правках — одно предупреждение «сохраним и сгенерируем» (оно же
   * покрывает перезапись для regenerate); провал сохранения — тост, генерация не стартует. Без правок
   * у regenerate своё подтверждение «перезапишет текст», у generate — без подтверждения.
   * forceAskUser — кнопка «с вопросами»: модель обязана сначала задать уточняющие вопросы.
   */
  const generate = async (category: CardCategory, isRegenerate: boolean, forceAskUser = false) => {
    if (cardId === undefined) return;
    const title = category.title || "…";
    const askNote = forceAskUser ? " Сначала ИИ задаст уточняющие вопросы." : "";

    if (formDirty) {
      const message = isRegenerate
        ? `Есть несохранённые изменения — карточка будет сохранена, а текущий текст блока «${title}» заменён новым.`
        : "Есть несохранённые изменения — карточка будет сохранена, после чего запустится генерация.";
      const confirmed = await confirmAction(message + askNote, {
        title: "Сохранить и сгенерировать?",
        confirmText: "Сохранить и сгенерировать",
      });
      if (!confirmed) return;
      setGeneratingForced(forceAskUser);
      setGeneratingId(category.id);
      if (!(await saveForm())) {
        setGeneratingId(null);
        showToast({ type: "error", message: "Не удалось сохранить карточку" });
        return;
      }
      await runGenerate(cardId, isRegenerate ? category.id : undefined, forceAskUser);
      return;
    }

    if (isRegenerate) {
      const confirmed = await confirmAction(
        `Текущий текст блока «${title}» будет заменён новым результатом генерации.${askNote}`,
        { title: "Перегенерировать блок?", confirmText: "Перегенерировать" },
      );
      if (!confirmed) return;
    }
    setGeneratingForced(forceAskUser);
    setGeneratingId(category.id);
    await runGenerate(cardId, isRegenerate ? category.id : undefined, forceAskUser);
  };

  return { generatingId, generatingForced, answering, generate, respond };
}
