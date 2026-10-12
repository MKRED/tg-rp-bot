import { ActionIcon, Textarea } from "@mantine/core";
import { motion } from "framer-motion";
import { ChevronsRight, Languages, SendHorizontal } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import styles from "./StoryInput.module.css";

export interface StoryInputHandle {
  /** Подставить текст в поле как редактируемый черновик директивы (фокус, курсор в конец). */
  setDraft: (text: string) => void;
}

interface StoryInputProps {
  /** Пустая строка — «Дальше», непустая — режиссёрская директива. */
  onAdvance: (directive: string) => void;
  /** Шторка перевода черновика (кнопка при пустом поле). */
  onTranslate: () => void;
  /** Идёт генерация — отправка недоступна, на кнопке спиннер. */
  disabled: boolean;
}

/**
 * Поле режиссёра. Пустое поле: слева перевод черновика, справа «Дальше»; с текстом — «отправить
 * директиву». Нижний отступ safe area — здесь: поле — нижний элемент экрана.
 */
export const StoryInput = forwardRef<StoryInputHandle, StoryInputProps>(function StoryInput(
  { onAdvance, onTranslate, disabled },
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
    onAdvance(value.trim());
    setValue("");
  };

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        {/* Кнопка перевода — только при пустом поле. Появляется с анимацией, а исчезает сразу: пока она
            сворачивалась бы, autosize поля успел бы померить высоту по старой (узкой) ширине. */}
        {empty && (
          <motion.div
            className={styles.side}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={MOTION_TRANSITION}
          >
            <ActionIcon
              variant="light"
              size={44}
              radius="xl"
              onClick={onTranslate}
              disabled={disabled}
              aria-label="Перевод черновика"
            >
              <Languages size={22} />
            </ActionIcon>
          </motion.div>
        )}
        <Textarea
          ref={textareaRef}
          className={styles.field}
          classNames={{ input: styles.input }}
          autosize
          minRows={1}
          maxRows={6}
          radius="xl"
          // Короткий, в одну строку на телефоне: что будет при пустом поле, говорит кнопка «Дальше» справа.
          placeholder="Директива или пусто"
          aria-label="Директива"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          disabled={disabled}
        />
        <ActionIcon
          size={44}
          radius="xl"
          onClick={submit}
          loading={disabled}
          aria-label={empty ? "Дальше" : "Отправить директиву"}
        >
          {empty ? <ChevronsRight size={24} /> : <SendHorizontal size={22} />}
        </ActionIcon>
      </div>
    </div>
  );
});
