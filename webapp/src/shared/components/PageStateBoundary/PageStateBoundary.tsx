import { Spinner, Text } from "@telegram-apps/telegram-ui";
import type { ReactNode } from "react";
import { PageTransition } from "../PageTransition";
import "./PageStateBoundary.css";

interface PageStateBoundaryProps {
  /** Первичная загрузка данных страницы — показываем полноэкранный спиннер по центру. */
  loading: boolean;
  /** Данные не найдены / ошибка — вместо контента показываем errorText. */
  error?: boolean;
  /** Текст ветки ошибки/«не найдено». */
  errorText?: ReactNode;
  /**
   * Контент готовой страницы. Именно thunk (а не ReactNode): вызывается ТОЛЬКО в ready-ветке, поэтому
   * безопасно дереференсит загруженные данные — до загрузки контент не строится и не падает на null.
   */
  children: () => ReactNode;
}

/**
 * Граница состояний страницы «полноэкранный спиннер → контент». Инкапсулирует повторяющийся на
 * edit-страницах паттерн: loading → центрированный Spinner, error → сообщение, иначе — контент.
 * Сама владеет PageTransition и проставляет ему phase (loading/ready), поэтому контент после спиннера
 * ВЪЕЗЖАЕТ, а не проявляется на месте (см. механику phase в PageTransition).
 *
 * Важно: страница не должна дополнительно оборачивать контент в свой PageTransition — тут ровно один,
 * иначе выйдет двойная анимация. Список-страницы (спиннер внутри уже отрендеренного List) — другой
 * паттерн, эту обёртку для них не используем.
 */
export function PageStateBoundary({
  loading,
  error = false,
  errorText = "Не найдено",
  children,
}: PageStateBoundaryProps) {
  if (loading) {
    return (
      <PageTransition phase="loading">
        <div className="page-state__center">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }
  if (error) {
    return (
      <PageTransition phase="ready">
        <Text Component="div" className="page-state__center">{errorText}</Text>
      </PageTransition>
    );
  }
  return <PageTransition phase="ready">{children()}</PageTransition>;
}
