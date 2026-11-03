import { ActionIcon, Textarea } from "@mantine/core";
import { ArrowUp } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { COAUTHOR_MESSAGE_MAX_LENGTH } from "../../types/coauthor";
import styles from "./CoauthorInput.module.css";

export interface CoauthorInputHandle {
  /** Подставить текст в поле (подсказка, «Переделать», возврат после ошибки) с фокусом и курсором в конце. */
  setDraft: (text: string) => void;
}

interface CoauthorInputProps {
  /** Отправка; false — не удалось, текст остаётся в поле. */
  onSend: (text: string) => Promise<boolean>;
  /** ИИ отвечает — отправка недоступна. */
  busy: boolean;
}

/** Поле сообщения соавтору. Нижний отступ safe area — здесь: поле — нижний элемент экрана. */
export const CoauthorInput = forwardRef<CoauthorInputHandle, CoauthorInputProps>(function CoauthorInput({ onSend, busy }, ref) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    setDraft: (text) => {
      setValue(text);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    },
  }));

  const text = value.trim();
  const submit = async () => {
    if (busy || !text) return;
    setValue("");
    // Упавший ход сервер не сохраняет — возвращаем текст, чтобы не набирать заново.
    if (!(await onSend(text))) setValue(text);
  };

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <Textarea
          ref={textareaRef}
          className={styles.field}
          classNames={{ input: styles.input }}
          autosize
          minRows={1}
          maxRows={6}
          radius="xl"
          maxLength={COAUTHOR_MESSAGE_MAX_LENGTH}
          placeholder="Что поменять?"
          aria-label="Сообщение"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Enter — отправить на ПК; Shift+Enter — перенос. На телефоне Enter — перенос (клавиатура без Shift).
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <ActionIcon size={44} radius="xl" onClick={() => void submit()} loading={busy} disabled={!text && !busy} aria-label="Отправить">
          <ArrowUp size={22} />
        </ActionIcon>
      </div>
    </div>
  );
});
