import { Input, Text, UnstyledButton } from "@mantine/core";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./PickerField.module.css";

interface PickerTriggerProps {
  label: string;
  description?: ReactNode;
  required?: boolean;
  /** Аватар или иконка слева. */
  leading?: ReactNode;
  /** Текст поля; нет — показываем placeholder приглушённо. */
  title?: string;
  /** Подпись под текстом поля. */
  subtitle?: string;
  placeholder?: string;
  /** Выбирать не из чего (или ещё грузится): поле не нажимается, без шеврона. */
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Поле-кнопка выбора: выглядит как заполненное поле ввода (аватар, текст, подпись, шеврон), по нажатию
 * вызывающий открывает свой список. Общая часть PickerField и полей со своим списком (приветствие чата).
 */
export function PickerTrigger({
  label,
  description,
  required,
  leading,
  title,
  subtitle,
  placeholder,
  disabled,
  onClick,
}: PickerTriggerProps) {
  return (
    // size md — подпись того же размера, что у полей ввода (их размер задан в теме).
    <Input.Wrapper label={label} description={description} withAsterisk={required} size="md">
      <UnstyledButton className={styles.field} onClick={onClick} disabled={disabled} aria-haspopup="dialog">
        {leading}
        <div className={styles.text}>
          <Text c={title ? undefined : "dimmed"} truncate>
            {title ?? placeholder}
          </Text>
          {subtitle && (
            <Text size="sm" c="dimmed" truncate>
              {subtitle}
            </Text>
          )}
        </div>
        {!disabled && <ChevronRight size={18} className={styles.chevron} aria-hidden />}
      </UnstyledButton>
    </Input.Wrapper>
  );
}
