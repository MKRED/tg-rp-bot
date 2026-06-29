import { Spinner } from "@telegram-apps/telegram-ui";
import { ChevronsRight, Languages, SendHorizontal } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export interface StoryInputHandle {
  /** Подставить текст в поле как редактируемый черновик директивы (ресайз + фокус). */
  setDraft: (text: string) => void;
}

interface StoryInputProps {
  /** Пустая строка → «Дальше» (continue); непустая → режиссёрская директива. */
  onAdvance: (directive: string) => void;
  /** Открыть штору перевода черновика (кнопка при пустом поле). */
  onTranslate: () => void;
  disabled: boolean;
}

/** Поле режиссёра: пишет директиву или жмёт «Дальше» при пустом поле. */
export const StoryInput = forwardRef<StoryInputHandle, StoryInputProps>(function StoryInput(
  { onAdvance, onTranslate, disabled },
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
    // Без добавки рамки поле остаётся на ~рамку короче контента (лишняя прокрутка после набора/удаления).
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
    onAdvance(value.trim());
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="story-input">
      {/* Кнопка перевода видна только при пустом поле — исчезает, как только режиссёр начал печатать. */}
      {!hasText && (
        <button
          className="story-input__translate"
          onClick={onTranslate}
          disabled={disabled}
          type="button"
          aria-label="Перевод"
        >
          <Languages size={22} />
        </button>
      )}
      <textarea
        ref={textareaRef}
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
});
