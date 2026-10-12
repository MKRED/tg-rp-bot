import type { AnswerCardQuestionsInput, CardGenerationError } from "@tg-rp-bot/shared";
import { useState } from "react";
import { ApiError } from "../../../../shared/api/client";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { useToast } from "../../../../shared/toast";
import { answerCardBlockQuestions, generateCardBlock } from "../../api/cards-api";
import type { CardCategory } from "../../types/card";

// satisfies — каждый код отказа сервера обязан иметь текст (контракт в @tg-rp-bot/shared).
const ERROR_MESSAGES: Record<string, string> = {
  preset_required: "Сначала выберите пресет ИИ для генерации",
  nothing_to_generate: "Все включённые блоки уже сгенерированы",
  target_not_found: "Этот блок больше не актуален — обновите карточку",
  busy: "Генерация уже идёт, подождите",
  not_found: "Карточка не найдена",
  no_pending_question: "Вопрос уже неактуален — сгенерируйте блок заново",
  answers_mismatch: "Не удалось отправить ответы — попробуйте сгенерировать блок заново",
} satisfies Record<CardGenerationError, string>;

function errorMessage(err: unknown): string {
  const code = err instanceof ApiError ? err.message : "";
  return ERROR_MESSAGES[code] ?? (code || "Не удалось сгенерировать блок");
}

interface UseCardGenerationArgs {
  /** undefined — карточка ещё не сохранена (роут генерации требует существующий id). */
  cardId: number | undefined;
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
   * правки других блоков, сделанные за это время.
   */
  onPendingQuestions: (categoryId: string, questions: CardCategory["pendingQuestions"]) => void;
  /** Результат генерации уже сохранён на сервере — форма синхронизирует и стейт, и baseline. */
  onGenerated: (categoryId: string, content: string) => void;
}

/**
 * Запросы генерации блоков карточки: «Сгенерировать» следующий пустой блок, «Перегенерировать»
 * готовый, ответы на уточняющие вопросы ask_user. Вопросы и ответы хранятся на самой категории
 * (приходят с сервера в карточке) — у ответа нет ограничения по времени, состояние переживает reload.
 */
export function useCardGeneration({
  cardId,
  formDirty,
  saveForm,
  onPendingQuestions,
  onGenerated,
}: UseCardGenerationArgs) {
  const { showToast } = useToast();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);

  /**
   * id уже сужен вызывающим до number — ранний выход по undefined после setGeneratingId оставил бы
   * кнопки выключенными навсегда. categoryId для «Сгенерировать» не передаём — цель выбирает сервер
   * по сохранённой карточке (локальная очередь могла устареть, если карточку меняли из другой сессии;
   * результат мержится по id из ответа). Для «Перегенерировать» цель — явно этот блок.
   */
  const runGenerate = async (id: number, categoryId?: string) => {
    try {
      const result = await generateCardBlock(id, categoryId);
      if (result.status === "questions") {
        onPendingQuestions(result.categoryId, result.questions);
        return; // generatingId остаётся — блок ждёт ответа в карусели
      }
      onGenerated(result.categoryId, result.content);
      setGeneratingId(null);
    } catch (err) {
      showToast({ type: "error", message: errorMessage(err) });
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
        onPendingQuestions(result.categoryId, result.questions); // новый раунд уточнений
        return;
      }
      onGenerated(result.categoryId, result.content);
      setGeneratingId(null);
    } catch (err) {
      showToast({ type: "error", message: errorMessage(err) });
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
   */
  const generate = async (category: CardCategory, isRegenerate: boolean) => {
    if (cardId === undefined) return;
    const title = category.title || "…";

    if (formDirty) {
      const message = isRegenerate
        ? `Есть несохранённые изменения — карточка будет сохранена, а текущий текст блока «${title}» заменён новым.`
        : "Есть несохранённые изменения — карточка будет сохранена, после чего запустится генерация.";
      const confirmed = await confirmAction(message, {
        title: "Сохранить и сгенерировать?",
        confirmText: "Сохранить и сгенерировать",
      });
      if (!confirmed) return;
      setGeneratingId(category.id);
      if (!(await saveForm())) {
        setGeneratingId(null);
        showToast({ type: "error", message: "Не удалось сохранить карточку" });
        return;
      }
      await runGenerate(cardId, isRegenerate ? category.id : undefined);
      return;
    }

    if (isRegenerate) {
      const confirmed = await confirmAction(`Текущий текст блока «${title}» будет заменён новым результатом генерации.`, {
        title: "Перегенерировать блок?",
        confirmText: "Перегенерировать",
      });
      if (!confirmed) return;
    }
    setGeneratingId(category.id);
    await runGenerate(cardId, isRegenerate ? category.id : undefined);
  };

  return { generatingId, answering, generate, respond };
}
