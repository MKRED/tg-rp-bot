import { ActionIcon, Button, Group, Text, Textarea } from "@mantine/core";
import { SendHorizontal, Sparkles } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { InputActionsMenu } from "./InputActionsMenu";
import styles from "./ChatInput.module.css";

export interface ChatInputHandle {
  /** Подставить текст в поле как редактируемый черновик (фокус, курсор в конец). */
  setDraft: (text: string) => void;
}

interface ChatInputProps {
  onSend: (content: string) => void;
  /** Кнопка при пустом поле — запросить ответ ИИ. */
  onGetResponse: () => void;
  /** Окно вариантов реплики от вашего лица (меню «+» при пустом поле). */
  onImpersonate: () => void;
  /** Шторка перевода черновика (меню «+» при пустом поле). */
  onTranslate: () => void;
  /** Идёт правка сообщения — над полем плашка «Редактирование» с отменой. */
  editing: boolean;
  onCancelEdit: () => void;
  /** Идёт генерация — отправка недоступна, на кнопке спиннер. */
  disabled: boolean;
}

/**
 * Поле ввода чата. Пустое поле: слева «+» (действия), справа — «получить ответ ИИ»; с текстом —
 * «отправить». Нижний отступ safe area — здесь: поле — нижний элемент экрана.
 */
export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, onGetResponse, onImpersonate, onTranslate, editing, onCancelEdit, disabled },
  ref,
) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const empty = !value.trim();

  useImperativeHandle(ref, () => ({
    setDraft: (text: string) => {
      setValue(text);
      // value применится после рендера — фокус и курсор в конец на следующем кадре.
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    },
  }));

  const submit = () => {
    if (disabled) return;
    if (empty) {
      onGetResponse();
      return;
    }
    onSend(value.trim());
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        {editing && (
          <Group gap="xs" className={styles.editing}>
            <Text size="sm" c="dimmed">
              Редактирование сообщения
            </Text>
            <Button variant="subtle" size="compact-sm" onClick={onCancelEdit}>
              Отмена
            </Button>
          </Group>
        )}
        <div className={styles.row}>
          {empty && !editing && <InputActionsMenu onImpersonate={onImpersonate} onTranslate={onTranslate} disabled={disabled} />}
          <Textarea
            ref={textareaRef}
            className={styles.field}
            classNames={{ input: styles.input }}
            autosize
            minRows={1}
            maxRows={6}
            radius="xl"
            placeholder="Написать сообщение…"
            aria-label="Сообщение"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            disabled={disabled}
          />
          <ActionIcon
            size={44}
            radius="xl"
            onClick={submit}
            loading={disabled}
            aria-label={empty ? "Получить ответ" : "Отправить"}
          >
            {empty ? <Sparkles size={22} /> : <SendHorizontal size={22} />}
          </ActionIcon>
        </div>
      </div>
    </div>
  );
});
