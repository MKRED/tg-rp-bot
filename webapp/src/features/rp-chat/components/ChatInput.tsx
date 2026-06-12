import { Spinner } from "@telegram-apps/telegram-ui";
import { SendHorizontal, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  /** Вызывается при нажатии кнопки с пустым полем — запрашивает ответ ИИ. */
  onGetResponse?: () => void;
  disabled: boolean;
}

export function ChatInput({ onSend, onGetResponse, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (disabled) return;
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } else {
      onGetResponse?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = отправить, Shift+Enter = новая строка; пустой Enter ничего не делает
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) submit();
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
        disabled={disabled}
        type="button"
        aria-label={value.trim() ? "Отправить" : "Получить ответ"}
      >
        {disabled ? <Spinner size="s" /> : value.trim() ? <SendHorizontal size={20} /> : <Sparkles size={20} />}
      </button>
    </div>
  );
}
