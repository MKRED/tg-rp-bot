import { popup } from "@telegram-apps/sdk-react";

interface ConfirmOptions {
  /** Обязателен — попап без хедера выглядит как случайная подсказка, а не как диалог. */
  title: string;
  /** Текст подтверждающей кнопки. */
  confirmText?: string;
  /** Стиль подтверждающей кнопки — красный "destructive" (по умолчанию, для удаления)
   * или обычный "default" (для неразрушительных действий вроде копирования). */
  destructive?: boolean;
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
export async function showAlert(message: string, title: string): Promise<void> {
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
  { title, confirmText = "Удалить", destructive = true }: ConfirmOptions,
): Promise<boolean> {
  if (popup.show.isAvailable()) {
    const pressed = await popup.show({
      title,
      message,
      buttons: [
        { id: "confirm", type: destructive ? "destructive" : "default", text: confirmText },
        { id: "cancel", type: "cancel" },
      ],
    });
    return pressed === "confirm";
  }
  return window.confirm(message);
}
