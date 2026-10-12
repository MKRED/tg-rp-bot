import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { PromptEditorBody } from "./PromptEditorBody";
import styles from "./PromptEditorOverlay.module.css";

interface PromptEditorOverlayProps {
  opened: boolean;
  title: string;
  placeholder?: string;
  value: string;
  onSave: (value: string) => void;
  /** Закрыть без сохранения — зовётся уже после подтверждения, если текст правили. */
  onClose: () => void;
}

// Брейкпоинт sm Mantine (48em) — граница «телефон / широкий экран», как в ResponsiveSheet.
const WIDE_QUERY = "(min-width: 48em)";

/**
 * Полноэкранный редактор длинного текста (промпт, премиза, бит истории). На телефоне — на весь экран,
 * на широком — большое окно по центру, чтобы строки не растягивались на весь монитор.
 *
 * Содержимое (PromptEditorBody) монтируется на каждое открытие, поэтому черновик и история правок
 * начинаются со свежего `value`. Само окно не закрывается ни крестиком, ни Escape, ни кликом мимо:
 * «Отмена», Escape и «Назад» Telegram обрабатывает тело — с подтверждением, если текст правили.
 */
export function PromptEditorOverlay({ opened, title, placeholder, value, onSave, onClose }: PromptEditorOverlayProps) {
  const wide = useMediaQuery(WIDE_QUERY, false, { getInitialValueInEffect: false });

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      fullScreen={!wide}
      size="48rem"
      centered
      closeOnEscape={false}
      closeOnClickOutside={false}
      // classNames, а не className у Modal.Content: тот уходит и на обёртку-центровщик (inner).
      classNames={{ content: styles.content }}
    >
      <Modal.Overlay />
      <Modal.Content>
        <PromptEditorBody
          title={title}
          placeholder={placeholder}
          value={value}
          opened={opened}
          onSave={onSave}
          onCancel={onClose}
        />
      </Modal.Content>
    </Modal.Root>
  );
}
