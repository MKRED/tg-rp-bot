import { Spinner } from "@telegram-apps/telegram-ui";
import { SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Сбрасываем высоту textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = отправить, Shift+Enter = новая строка
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Авторазмер: сбрасываем до auto, потом ставим по scrollHeight
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="chat-input">
      <textarea
        ref={textareaRef}
        className="chat-input__textarea"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Написать сообщение…"
        disabled={disabled}
        rows={1}
      />
      <button
        className="chat-input__send"
        onClick={submit}
        disabled={disabled || !value.trim()}
        type="button"
        aria-label="Отправить"
      >
        {disabled ? <Spinner size="s" /> : <SendHorizontal size={20} />}
      </button>
    </div>
  );
}
