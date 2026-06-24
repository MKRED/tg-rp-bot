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

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = () => {
    if (disabled) return;
    onAdvance(value.trim());
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const hasText = value.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        padding: 8,
        borderTop: "1px solid var(--tgui--divider)",
        background: "var(--tgui--bg_color)",
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          resize();
        }}
        placeholder="Режиссёрская директива… (пусто = «Дальше»)"
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          border: "none",
          outline: "none",
          background: "var(--tgui--secondary_bg_color)",
          color: "var(--tgui--text_color)",
          borderRadius: 12,
          padding: "10px 12px",
          font: "inherit",
          maxHeight: 160,
        }}
      />
      <button
        onClick={submit}
        disabled={disabled}
        type="button"
        aria-label={hasText ? "Применить директиву" : "Дальше"}
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "none",
          background: "var(--tgui--button_color)",
          color: "var(--tgui--button_text_color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {disabled ? <Spinner size="s" /> : hasText ? <SendHorizontal size={22} /> : <ChevronsRight size={24} />}
      </button>
    </div>
  );
}
