import { ActionIcon, Popover, Text, UnstyledButton } from "@mantine/core";
import { ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { estimateTokens } from "../../text/tokens";
import { PromptEditorOverlay } from "../PromptEditorOverlay";
import styles from "./PromptEditorField.module.css";

interface PromptEditorFieldProps {
  header: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Сколько строк текста видно в превью. По умолчанию 4. */
  previewLines?: number;
}

/**
 * Поле длинного промпта: подпись (с подсказкой по тапу и счётчиком токенов) и превью текста, обрезанное
 * по строкам. Тап по превью открывает PromptEditorOverlay — редактирование на весь экран.
 */
export function PromptEditorField({
  header,
  hint,
  placeholder,
  value,
  onChange,
  previewLines = 4,
}: PromptEditorFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className={styles.label}>
        <Text fw={500} className={styles.labelText}>
          {header}
          {hint && (
            // Подсказка — по тапу, а не по наведению: на телефоне hover нет.
            <Popover width={280} position="bottom-start" withArrow shadow="md">
              <Popover.Target>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Подсказка" className={styles.hintButton}>
                  <Info size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm">{hint}</Text>
              </Popover.Dropdown>
            </Popover>
          )}
        </Text>
        <Text size="xs" c="dimmed" className={styles.tokens}>
          ~{estimateTokens(value)} токенов
        </Text>
      </div>

      <UnstyledButton className={styles.field} onClick={() => setOpen(true)} aria-label={`${header}: редактировать`}>
        <Text size="sm" c={value ? undefined : "dimmed"} lineClamp={previewLines} className={styles.preview}>
          {value || "Нажмите, чтобы заполнить"}
        </Text>
        <ChevronRight size={18} className={styles.chevron} aria-hidden />
      </UnstyledButton>

      <PromptEditorOverlay
        opened={open}
        title={header}
        placeholder={placeholder}
        value={value}
        onSave={(next) => {
          onChange(next);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
