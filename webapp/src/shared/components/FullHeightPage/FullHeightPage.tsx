import type { ReactNode } from "react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { BackNavButton } from "../BackNavButton";
import { PageTransition } from "../PageTransition";
import styles from "./FullHeightPage.module.css";

interface FullHeightPageProps {
  /** Заголовок вкладки браузера: своей шапки у каркаса нет, на экране он не рисуется. */
  title?: string;
  /** Дискриминатор фазы (loading/ready) — перезапускает анимацию появления, как у AppPage. */
  phase?: string;
  /**
   * Плавающая «Назад» в браузере — когда у экрана нет своей шапки с кнопкой (граф, ошибка загрузки).
   * Не включать на время загрузки экрана с шапкой: кнопка мелькнула бы в углу, а потом «прыгнула» в шапку.
   */
  floatingBack?: boolean;
  children: ReactNode;
}

/**
 * Каркас экрана ровно на высоту окна, без прокрутки страницы: граф веток, лента чата. Прокручивается
 * (или двигается) что-то внутри — дети раскладываются flex-колонкой, растягиваемый ребёнок ставит себе
 * `flex: 1; min-height: 0`. Остальное как у AppPage: фон палитры,
 * верхний отступ safe area. Нижний отступ safe area — забота нижнего элемента экрана (поле ввода).
 */
export function FullHeightPage({ title, phase, floatingBack, children }: FullHeightPageProps) {
  usePageTitle(title);
  return (
    <div className={styles.page}>
      {/* Кнопка внутри анимации появления: иначе она возникала бы мгновенно, поверх ещё гаснущей
          предыдущей страницы, а не вместе с этим экраном. */}
      <PageTransition phase={phase} className={styles.body}>
        {floatingBack && <BackNavButton floating />}
        {children}
      </PageTransition>
    </div>
  );
}
