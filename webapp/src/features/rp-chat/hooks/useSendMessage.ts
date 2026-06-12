import { useCallback, useState } from "react";
import { editMessage, regenerateMessage, sendMessage } from "../api/index";
import type { MessageInPath } from "../types/chat";

type OnDoneCallback = (userMsg: MessageInPath | null, assistantMsg: MessageInPath) => void;

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
          onDone: (assistantMsg) => {
            setStreamingText(null);
            onDone(userMsg, assistantMsg);
          },
          onError: () => setStreamingText(null),
        });
      } finally {
        setSending(false);
        setStreamingText(null);
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
          onDone: (assistantMsg) => {
            setStreamingText(null);
            onDone(userMsg, assistantMsg);
          },
          onError: () => setStreamingText(null),
        });
      } finally {
        setSending(false);
        setStreamingText(null);
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
          onDone: (assistantMsg) => {
            setStreamingText(null);
            onDone(null, assistantMsg);
          },
          onError: () => setStreamingText(null),
        });
      } finally {
        setSending(false);
        setStreamingText(null);
      }
    },
    [chatId, onDone, sending],
  );

  return { send, edit, regenerate, sending, streamingText };
}
