import { useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "../../../shared/toast";
import { answerCoauthorQuestions, reviewCoauthorProposals, sendCoauthorMessage } from "../api/coauthor-api";
import { coauthorErrorMessage } from "../lib/errors";
import type { CoauthorAnswerInput, CoauthorChat } from "../types/coauthor";

/**
 * Действия в чате соавтора. sendingText — отправленное, но ещё без ответа сообщение: лента показывает
 * его сразу, вместе с индикатором «думает». Ошибка хода — тост, а send возвращает false, чтобы экран
 * вернул текст в поле ввода (сервер упавший ход не сохраняет).
 */
export function useCoauthorActions(chatId: number, setChat: Dispatch<SetStateAction<CoauthorChat | undefined>>) {
  const { showToast } = useToast();
  const [sendingText, setSendingText] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const send = async (text: string): Promise<boolean> => {
    setSendingText(text);
    try {
      const { chat } = await sendCoauthorMessage(chatId, text);
      setChat(chat);
      return true;
    } catch (err) {
      console.error("Coauthor send failed", err);
      showToast({ type: "error", message: coauthorErrorMessage(err) });
      return false;
    } finally {
      setSendingText(null);
    }
  };

  const answer = async (input: CoauthorAnswerInput) => {
    setAnswering(true);
    try {
      const { chat } = await answerCoauthorQuestions(chatId, input);
      setChat(chat);
    } catch (err) {
      console.error("Coauthor answer failed", err);
      showToast({ type: "error", message: coauthorErrorMessage(err) });
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

  return { send, sendingText, answer, answering, review, reviewing };
}
