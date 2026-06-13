import { popup } from "@telegram-apps/sdk-react";

interface ConfirmOptions {
  title?: string;
  /** Текст подтверждающей (деструктивной) кнопки. */
  confirmText?: string;
}

/**
 * Подтверждение действия через нативный попап Telegram.
 *
 * window.confirm в webview Telegram ненадёжен (на части клиентов подавляется), поэтому
 * используем popup.show из SDK. Вне Telegram (dev-браузер) попап недоступен — откатываемся
 * на window.confirm, чтобы отладка из браузера продолжала работать.
 */
/**
 * Показывает информационный попап с единственной кнопкой «ОК».
 * Используется для не-деструктивных уведомлений (ошибки, предупреждения).
 */
export async function showAlert(message: string, title = ""): Promise<void> {
  if (popup.show.isAvailable()) {
    await popup.show({
      title,
      message,
      buttons: [{ id: "ok", type: "close" }],
    });
    return;
  }
  window.alert(message);
}

export async function confirmAction(
  message: string,
  { title = "", confirmText = "Удалить" }: ConfirmOptions = {},
): Promise<boolean> {
  if (popup.show.isAvailable()) {
    const pressed = await popup.show({
      title,
      message,
      buttons: [
        { id: "cancel", type: "cancel" },
        { id: "confirm", type: "destructive", text: confirmText },
      ],
    });
    return pressed === "confirm";
  }
  return window.confirm(message);
}
