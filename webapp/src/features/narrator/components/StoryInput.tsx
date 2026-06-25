import { Spinner } from "@telegram-apps/telegram-ui";
import { ChevronsRight, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

interface StoryInputProps {
  /** Пустая строка → «Дальше» (continue); непустая → режиссёрская директива. */
  onAdvance: (directive: string) => void;
  disabled: boolean;
}

/** Поле режиссёра: пишет директиву или жмёт «Дальше» при пустом поле. */
export function StoryInput({ onAdvance, disabled }: StoryInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Авторазмер: сбрасываем до auto, потом ставим по scrollHeight (макс 160px).
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // box-sizing: border-box — scrollHeight не включает рамку, а style.height её учитывает.
    // Без добавки рамки поле остаётся на ~рамку короче контента (лишняя прокрутка после набора/удаления).
    const borderY = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + borderY, 160)}px`;
  };

  const submit = () => {
    if (disabled) return;
    onAdvance(value.trim());
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="story-input">
      <textarea
        ref={ref}
        className="story-input__textarea"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          resize();
        }}
        placeholder="Директива… (пусто = «Дальше»)"
        disabled={disabled}
        rows={1}
      />
      <button
        className="story-input__send"
        onClick={submit}
        disabled={disabled}
        type="button"
        aria-label={hasText ? "Применить директиву" : "Дальше"}
      >
        {disabled ? <Spinner size="s" /> : hasText ? <SendHorizontal size={22} /> : <ChevronsRight size={24} />}
      </button>
    </div>
  );
}
