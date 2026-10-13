import type { ReactNode } from "react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { PageTransition } from "../PageTransition";
import styles from "./FullHeightPage.module.css";

interface FullHeightPageProps {
  /** Заголовок вкладки браузера: своей шапки у каркаса нет, на экране он не рисуется. */
  title?: string;
  /** Дискриминатор фазы (loading/ready) — перезапускает анимацию появления, как у AppPage. */
  phase?: string;
  children: ReactNode;
}

/**
 * Каркас экрана ровно на высоту окна, без прокрутки страницы: граф веток, лента чата. Прокручивается
 * (или двигается) что-то внутри — дети раскладываются flex-колонкой, растягиваемый ребёнок ставит себе
 * `flex: 1; min-height: 0`. Остальное как у AppPage: фон палитры,
 * верхний отступ safe area. Нижний отступ safe area — забота нижнего элемента экрана (поле ввода).
 */
export function FullHeightPage({ title, phase, children }: FullHeightPageProps) {
  usePageTitle(title);
  return (
    <div className={styles.page}>
      <PageTransition phase={phase} className={styles.body}>
        {children}
      </PageTransition>
    </div>
  );
}
