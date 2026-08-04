import { ButtonCell, List, Modal } from "@telegram-apps/telegram-ui";
import { RefreshCw, Trash2 } from "lucide-react";

interface TranslateActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

/**
 * Модалка действий над закэшированным переводом — фоллбэк долгого нажатия на кнопку Globe там,
 * где нативный попап Telegram (showTranslateActionsPopup) недоступен (ПК-клиенты, дев-браузер —
 * см. isTranslateActionsPopupAvailable). Тот же tgui Modal, что и у пикеров формы (RpChatNewPage),
 * а не floating-меню у кнопки и не window.confirm (у него фиксированный текст кнопок/лимит в два).
 */
export function TranslateActionModal({
  open,
  onOpenChange,
  onRegenerate,
  onDelete,
}: TranslateActionModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} header={<Modal.Header>Перевод</Modal.Header>}>
      <List>
        <ButtonCell
          before={<RefreshCw size={18} />}
          onClick={() => {
            onRegenerate();
            onOpenChange(false);
          }}
        >
          Перевести заново
        </ButtonCell>
        <ButtonCell
          mode="destructive"
          before={<Trash2 size={18} />}
          onClick={() => {
            onDelete();
            onOpenChange(false);
          }}
        >
          Удалить перевод
        </ButtonCell>
      </List>
    </Modal>
  );
}
