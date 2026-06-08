import { useEffect, useRef, useState } from "react";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { INITIAL_MESSAGES, MOCK_CHARACTER, mockCharacterReply } from "./mock";
import type { RpMessage } from "./types";
import "./rp-chat.css";

let idCounter = 0;
const nextId = () => `m-${Date.now()}-${idCounter++}`;

/** Главный экран ролевой игры: шапка сцены, лента реплик и поле ввода. */
export function RpChat() {
  const [messages, setMessages] = useState<RpMessage[]>(INITIAL_MESSAGES);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка к последней реплике при появлении новых сообщений или индикатора печати
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = (text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), author: "user", text, at: Date.now() }]);
    setTyping(true);

    // Временная имитация ответа персонажа. Позже заменим на /api/chat → OpenRouter (серверно).
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), author: "character", text: mockCharacterReply(), at: Date.now() },
      ]);
      setTyping(false);
    }, 900);
  };

  return (
    <div className="rp-screen">
      <ChatHeader character={MOCK_CHARACTER} typing={typing} />

      <main className="rp-messages">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {typing && (
          <div className="rp-typing" aria-label="Персонаж печатает">
            <span />
            <span />
            <span />
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <Composer disabled={typing} onSend={handleSend} />
    </div>
  );
}
