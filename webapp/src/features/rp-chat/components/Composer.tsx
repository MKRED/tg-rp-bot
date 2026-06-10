import { useState, type KeyboardEvent } from "react";

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

/** Поле ввода реплики: автоотправка по Enter (Shift+Enter — перенос строки). */
export function Composer({ disabled, onSend }: ComposerProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="rp-composer">
      <textarea
        className="rp-composer__input"
        placeholder="Опишите действие или реплику…"
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="rp-composer__send"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-label="Отправить"
      >
        ➤
      </button>
    </div>
  );
}
