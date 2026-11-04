import { SSE_EVENTS, type SseTokenData } from "@tg-rp-bot/shared";
import { useState, type Dispatch, type SetStateAction } from "react";
import { ApiError } from "../../../shared/api/client";
import { useToast } from "../../../shared/toast";
import { getCoauthorChat, reviewCoauthorProposals } from "../api/coauthor-api";
import { streamCoauthorTurn } from "../api/coauthor-stream";
import { coauthorErrorCodeMessage, coauthorErrorMessage } from "../lib/errors";
import { appendLiveText, resetLiveAttempt, upsertLiveStep, type LiveItem } from "../lib/liveTurn";
import type { CoauthorAnswerInput, CoauthorChat, CoauthorStepEvent, CoauthorStreamError } from "../types/coauthor";

/**
 * Действия в чате соавтора. sendingText — отправленное, но ещё без ответа сообщение: лента показывает
 * его сразу, а live — шаги и текст идущего хода. Ошибка хода — тост, а send возвращает false, чтобы экран
 * вернул текст в поле ввода (сервер упавший ход не сохраняет).
 */
export function useCoauthorActions(chatId: number, setChat: Dispatch<SetStateAction<CoauthorChat | undefined>>) {
  const { showToast } = useToast();
  const [sendingText, setSendingText] = useState<string | null>(null);
  const [live, setLive] = useState<LiveItem[]>([]);
  const [answering, setAnswering] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  /**
   * Ход ИИ потоком. Три исхода: done — готовый чат; ход не начался или упал — true не возвращаем, экран
   * вернёт текст в поле; поток оборвался (сеть, свёрнутый WebView) — ход на сервере идёт дальше, поэтому
   * текст не возвращаем (повторная отправка задвоила бы сообщение), а подхватываем чат: running запустит опрос.
   */
  const runTurn = async (path: string, body: unknown): Promise<boolean> => {
    let finished = false;
    let failure: string | undefined;
    setLive([]);
    try {
      await streamCoauthorTurn(path, body, (event, data) => {
        switch (event) {
          case SSE_EVENTS.token:
            setLive((items) => appendLiveText(items, (data as unknown as SseTokenData).text));
            break;
          case SSE_EVENTS.reset:
            setLive(resetLiveAttempt);
            break;
          case SSE_EVENTS.step: {
            const { step, proposals } = data as unknown as CoauthorStepEvent;
            setLive((items) => upsertLiveStep(items, step));
            // Правка видна в карточках сразу; кнопки решений заблокированы до конца хода (busy).
            if (proposals) setChat((prev) => prev && { ...prev, proposals });
            break;
          }
          case SSE_EVENTS.done:
            finished = true;
            setChat((data as unknown as { chat: CoauthorChat }).chat);
            break;
          case SSE_EVENTS.error:
            failure = (data as unknown as CoauthorStreamError).code;
            break;
        }
      });
    } catch (err) {
      if (err instanceof ApiError) {
        console.error("Coauthor turn refused", err);
        showToast({ type: "error", message: coauthorErrorMessage(err) });
        return false;
      }
      console.error("Coauthor stream broke", err);
    } finally {
      setLive([]);
    }
    if (finished) return true;
    // В обоих оставшихся случаях показанное устарело: упавший ход не сохранился, а оборванный ещё идёт.
    getCoauthorChat(chatId)
      .then((res) => setChat(res.chat))
      .catch((err) => console.error("Failed to reload coauthor chat", err));
    if (failure === undefined) return true;
    showToast({ type: "error", message: coauthorErrorCodeMessage(failure) });
    return false;
  };

  const send = async (text: string): Promise<boolean> => {
    setSendingText(text);
    try {
      return await runTurn(`/coauthor/${chatId}/messages`, { text });
    } finally {
      setSendingText(null);
    }
  };

  const answer = async (input: CoauthorAnswerInput) => {
    setAnswering(true);
    try {
      await runTurn(`/coauthor/${chatId}/answer`, input);
    } finally {
      setAnswering(false);
    }
  };

  const review = async (proposalIds: string[], accept: boolean) => {
    setReviewing(true);
    try {
      const { chat, stale, busy } = await reviewCoauthorProposals(chatId, proposalIds, accept);
      setChat(chat);
      if (stale.length > 0) {
        showToast({ type: "error", message: "Блок изменили после предложения — правку не принять, попросите переделать" });
      } else if (busy.length > 0) {
        showToast({ type: "error", message: "Карточка сейчас сохраняется или генерируется — попробуйте ещё раз" });
      }
    } catch (err) {
      console.error("Coauthor review failed", err);
      showToast({ type: "error", message: coauthorErrorMessage(err, "Не удалось сохранить решение") });
    } finally {
      setReviewing(false);
    }
  };

  return { send, sendingText, live, answer, answering, review, reviewing };
}
