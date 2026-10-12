import { Button, Stack } from "@mantine/core";
import { RefreshCw, Trash2 } from "lucide-react";
import { ResponsiveSheet } from "../ResponsiveSheet";

interface TranslateActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

/**
 * Действия над закэшированным переводом — фоллбэк долгого нажатия на кнопку Globe там, где нативный
 * попап Telegram (showTranslateActionsPopup) недоступен: ПК-клиенты, браузер (см.
 * isTranslateActionsPopupAvailable). Не window.confirm: у него фиксированный текст и две кнопки.
 */
export function TranslateActionModal({ open, onOpenChange, onRegenerate, onDelete }: TranslateActionModalProps) {
  const run = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <ResponsiveSheet opened={open} onClose={() => onOpenChange(false)} title="Перевод">
      <Stack gap="xs">
        <Button variant="light" fullWidth leftSection={<RefreshCw size={18} />} onClick={() => run(onRegenerate)}>
          Перевести заново
        </Button>
        <Button variant="subtle" color="red" fullWidth leftSection={<Trash2 size={18} />} onClick={() => run(onDelete)}>
          Удалить перевод
        </Button>
      </Stack>
    </ResponsiveSheet>
  );
}
