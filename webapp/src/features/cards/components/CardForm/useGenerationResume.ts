import type { CardGenerationStatus } from "@tg-rp-bot/shared";
import { useEffect, useRef } from "react";
import { useToast } from "../../../../shared/toast";
import { getCard, getCardGenerationStatus } from "../../api/cards-api";
import { generationStatusErrorMessage } from "../../lib/generationErrors";
import type { CardCategory } from "../../types/card";

const POLL_INTERVAL_MS = 4000;
/** Дольше DeepSeek запрос в очереди не держит (10 минут), плюс запас на саму генерацию. */
const POLL_MAX_MS = 12 * 60 * 1000;
/** generatingId, пока сервер не выбрал цель: кнопки выключены, но ни один блок не крутится. */
const UNKNOWN_TARGET = "__resumed__";

type FinishedStatus = Exclude<CardGenerationStatus, { state: "running" }>;

interface UseGenerationResumeArgs {
  cardId: number | undefined;
  categories: CardCategory[];
  setGeneratingId: (id: string | null) => void;
  onPendingQuestions: (
    categoryId: string,
    questions: CardCategory["pendingQuestions"],
    toolContextTokens?: number,
  ) => void;
  onGenerated: (categoryId: string, content: string, toolContextTokens: number) => void;
}

/**
 * Подхватывает генерацию, начатую до обновления страницы. Запрос со старой страницы оборвался, а
 * сервер продолжает ждать ИИ (под нагрузкой DeepSeek держит запрос в очереди минутами) — без этого
 * блок молча появился бы только после следующего обновления, а кнопки отвечали бы «уже идёт».
 *
 * Один раз на открытие карточки спрашивает статус; если генерация идёт — уведомление, выключенные
 * кнопки и опрос, пока она не закончится. Затем блок (или вопросы ask_user) берётся из сохранённой
 * карточки и мержится точечно, как результат обычного запроса.
 */
export function useGenerationResume({
  cardId,
  categories,
  setGeneratingId,
  onPendingQuestions,
  onGenerated,
}: UseGenerationResumeArgs) {
  const { showToast } = useToast();
  // Через ref: эффект живёт одно открытие карточки, а не перезапускается на каждый рендер формы.
  const latest = useRef({ categories, setGeneratingId, onPendingQuestions, onGenerated, showToast });
  latest.current = { categories, setGeneratingId, onPendingQuestions, onGenerated, showToast };

  useEffect(() => {
    if (cardId === undefined) return;
    let cancelled = false;
    let resumed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const t0 = Date.now();
    const titleOf = (id: string | undefined) => latest.current.categories.find((c) => c.id === id)?.title || "…";

    const finish = async (status: FinishedStatus) => {
      const { setGeneratingId, onGenerated, onPendingQuestions, showToast } = latest.current;
      if (status.state === "failed") {
        showToast({ type: "error", message: generationStatusErrorMessage(status.error) });
        setGeneratingId(null);
        return;
      }
      const { card } = await getCard(cardId);
      if (cancelled) return;
      const category = card.categories.find((c) => c.id === status.categoryId);
      if (status.state === "questions" && category?.pendingQuestions?.length) {
        onPendingQuestions(category.id, category.pendingQuestions, category.toolContextTokens);
        showToast({ type: "info", message: `ИИ задал уточняющие вопросы по блоку «${titleOf(category.id)}»` });
        // generatingId не сбрасываем — как в обычном потоке: блок ждёт ответа в карусели.
        setGeneratingId(category.id);
        return;
      }
      if (status.state === "done" && category) {
        onGenerated(category.id, category.content, category.toolContextTokens ?? 0);
        showToast({ type: "success", message: `Блок «${titleOf(category.id)}» готов` });
      }
      setGeneratingId(null);
    };

    const poll = async () => {
      try {
        const { generation } = await getCardGenerationStatus(cardId);
        if (cancelled) return;
        if (generation?.state !== "running") {
          // Исход прошлой генерации без идущей — карточка уже пришла с ним, сообщать нечего.
          if (resumed) {
            if (generation) await finish(generation);
            else latest.current.setGeneratingId(null); // исход уже забыт сервером — показать нечего
          }
          return;
        }
        if (!resumed) {
          resumed = true;
          latest.current.showToast({
            type: "info",
            message: `Блок «${titleOf(generation.categoryId)}» ещё генерируется — ИИ сейчас отвечает медленно. Покажем, когда будет готово.`,
            duration: 6000,
          });
        }
        latest.current.setGeneratingId(generation.categoryId ?? UNKNOWN_TARGET);
      } catch (err) {
        // Статус — подсказка, а не основной путь: до подхвата сбой просто ничего не показывает, после —
        // следующий опрос попробует снова.
        console.warn("Card generation status poll failed", err);
        if (!resumed) return;
      }
      if (cancelled) return;
      if (Date.now() - t0 > POLL_MAX_MS) {
        latest.current.setGeneratingId(null);
        latest.current.showToast({ type: "error", message: "Генерация не ответила — обновите карточку позже" });
        return;
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cardId]);
}
