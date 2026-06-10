import type { RpMessage } from "../types/chat";

interface MessageBubbleProps {
  message: RpMessage;
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Реплика сцены. Нарратор рендерится по центру курсивом (описание обстановки),
 * игрок — справа, персонаж — слева, как в обычном мессенджере.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.author === "narrator") {
    return <div className="rp-narration">{message.text}</div>;
  }

  const isUser = message.author === "user";
  return (
    <div className={`rp-row ${isUser ? "rp-row--user" : "rp-row--character"}`}>
      <div className={`rp-bubble ${isUser ? "rp-bubble--user" : "rp-bubble--character"}`}>
        <span className="rp-bubble__text">{message.text}</span>
        <time className="rp-bubble__time">{formatTime(message.at)}</time>
      </div>
    </div>
  );
}
