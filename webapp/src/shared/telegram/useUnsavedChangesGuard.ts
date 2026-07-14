import { useEffect } from "react";
import { confirmAction } from "./confirm";
import { pushNavigationGuard } from "./navigationGuard";

/**
 * Блокирует уход с экрана (кнопка «Назад») подтверждающим попапом, пока isDirty=true.
 * Для форм с ручным сохранением одной кнопкой (весь стейт локальный, размонтирование теряет
 * правки без предупреждения).
 */
export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    return pushNavigationGuard(() =>
      confirmAction("Несохранённые изменения будут потеряны.", {
        title: "Уйти без сохранения?",
        confirmText: "Уйти",
      }),
    );
  }, [isDirty]);
}
