import { useCallback, useState } from "react";
import { editMessage, regenerateMessage, sendMessage } from "../api/messages-api";
import type { MessageInPath } from "../types/chat";

// commit гасит стримящийся пузырь. Вызывающая сторона зовёт его НЕ сразу, а в момент,
// когда реальный бит уже влит в ленту (refresh применился) — атомарная подмена без рывка.
type OnDoneCallback = (
  userMsg: MessageInPath | null,
  assistantMsg: MessageInPath,
  commit: () => void,
) => void;

export function useSendMessage(
  chatId: number,
  onDone: OnDoneCallback,
  onOptimisticUserMessage?: (msg: MessageInPath) => void,
) {
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);

  const send = useCallback(
    async (content: string) => {
      if (sending) return;
      setSending(true);
      setStreamingText("");
      let userMsg: MessageInPath | null = null;

      try {
        await sendMessage(chatId, content, {
          onUserMessage: (msg) => { userMsg = msg; onOptimisticUserMessage?.(msg); },
          onToken: (text) => setStreamingText((prev) => (prev ?? "") + text),
          onReset: () => setStreamingText(""), // ретрай: стираем плохой ответ
          // Стрим НЕ гасим здесь — отдаём commit наверх, он сработает после refresh (без рывка).
          onDone: (assistantMsg) => onDone(userMsg, assistantMsg, () => setStreamingText(null)),
          onError: () => setStreamingText(null),
        });
      } catch (err) {
        // readSSE на сетевом исключении (offline и т.п.) onError НЕ зовёт — снимаем стрим тут.
        console.error("RP send failed", err);
        setStreamingText(null);
      } finally {
        setSending(false);
      }
    },
    [chatId, onDone, sending],
  );

  const edit = useCallback(
    async (messageId: number, content: string) => {
      if (sending) return;
      setSending(true);
      // StreamingBubble не показываем сразу — для assistant-редактирования токенов не будет.
      // Устанавливаем "" только когда приходит userMessage (т.е. редактируем user-сообщение).
      let userMsg: MessageInPath | null = null;

      try {
        await editMessage(chatId, messageId, content, {
          onUserMessage: (msg) => { setStreamingText(""); userMsg = msg; onOptimisticUserMessage?.(msg); },
          onToken: (text) => setStreamingText((prev) => (prev ?? "") + text),
          onReset: () => setStreamingText(""), // ретрай: стираем плохой ответ
          onDone: (assistantMsg) => onDone(userMsg, assistantMsg, () => setStreamingText(null)),
          onError: () => setStreamingText(null),
        });
      } catch (err) {
        console.error("RP edit failed", err);
        setStreamingText(null);
      } finally {
        setSending(false);
      }
    },
    [chatId, onDone, sending],
  );

  const regenerate = useCallback(
    async (messageId: number) => {
      if (sending) return;
      setSending(true);
      setStreamingText("");

      try {
        await regenerateMessage(chatId, messageId, {
          onToken: (text) => setStreamingText((prev) => (prev ?? "") + text),
          onReset: () => setStreamingText(""), // ретрай: стираем плохой ответ
          onDone: (assistantMsg) => onDone(null, assistantMsg, () => setStreamingText(null)),
          onError: () => setStreamingText(null),
        });
      } catch (err) {
        console.error("RP regenerate failed", err);
        setStreamingText(null);
      } finally {
        setSending(false);
      }
    },
    [chatId, onDone, sending],
  );

  return { send, edit, regenerate, sending, streamingText };
}
