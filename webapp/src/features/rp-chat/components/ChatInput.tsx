import { Spinner } from "@telegram-apps/telegram-ui";
import { Lightbulb, SendHorizontal, Sparkles } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export interface ChatInputHandle {
  /** Подставить текст в поле как редактируемый черновик (ресайз + фокус). */
  setDraft: (text: string) => void;
}

interface ChatInputProps {
  onSend: (content: string) => void;
  /** Вызывается при нажатии кнопки с пустым полем — запрашивает ответ ИИ. */
  onGetResponse?: () => void;
  /** Открыть окно генерации реплики от лица пользователя (кнопка видна при пустом поле). */
  onImpersonate?: () => void;
  disabled: boolean;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onGetResponse, onImpersonate, disabled },
  ref,
) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Авторазмер: сбрасываем до auto, потом ставим по scrollHeight (макс 160px).
  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // box-sizing: border-box — scrollHeight не включает рамку, а style.height её учитывает.
    // Без этой добавки поле остаётся на ~рамку короче контента → остаётся лишняя прокрутка
    // после набора и последующего удаления текста.
    const borderY = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + borderY, 160)}px`;
  };

  useImperativeHandle(ref, () => ({
    setDraft: (text: string) => {
      setValue(text);
      // value применится после рендера — ресайз/фокус/курсор в конец на следующем кадре
      requestAnimationFrame(() => {
        resize();
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    },
  }));

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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    resize();
  };

  const empty = !value.trim();

  return (
    <div className="chat-input">
      {empty && onImpersonate && (
        <button
          className="chat-input__impersonate"
          onClick={onImpersonate}
          disabled={disabled}
          type="button"
          aria-label="Ответ от вашего лица"
        >
          <Lightbulb size={24} />
        </button>
      )}
      <textarea
        ref={textareaRef}
        className="chat-input__textarea"
        value={value}
        onChange={handleInput}
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
        {disabled ? <Spinner size="s" /> : value.trim() ? <SendHorizontal size={24} /> : <Sparkles size={24} />}
      </button>
    </div>
  );
});
