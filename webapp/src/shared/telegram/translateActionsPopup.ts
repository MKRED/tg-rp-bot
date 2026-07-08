import { popup } from "@telegram-apps/sdk-react";

export type TranslateAction = "regenerate" | "delete";

/** Доступен ли нативный попап (вне Telegram, в дев-браузере — нет). */
export function isTranslateActionsPopupAvailable(): boolean {
  return popup.show.isAvailable();
}

/**
 * Нативный попап действий над закэшированным переводом — открывается по долгому нажатию на
 * кнопку Globe вместо кастомного плавающего меню (то выглядело как случайная подсказка, а не
 * как источник действия). Вызывать только когда isTranslateActionsPopupAvailable() — иначе
 * popup.show бросит FunctionNotAvailableError.
 *
 * Возвращает null, если пользователь нажал «Отмена» или закрыл попап тапом снаружи.
 */
export async function showTranslateActionsPopup(): Promise<TranslateAction | null> {
  const pressed = await popup.show({
    title: "Перевод",
    message: "Выберите действие",
    buttons: [
      { id: "regenerate", type: "default", text: "Перевести заново" },
      { id: "delete", type: "destructive", text: "Удалить перевод" },
      { id: "cancel", type: "cancel" },
    ],
  });
  return pressed === "regenerate" || pressed === "delete" ? pressed : null;
}
