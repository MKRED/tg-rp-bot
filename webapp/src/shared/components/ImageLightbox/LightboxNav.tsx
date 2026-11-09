import { ActionIcon } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./ImageLightbox.module.css";

/** Листание в просмотре: стрелки на краях и подпись. Колбэк на краю не задан — стрелки нет. */
export interface LightboxNavigation {
  /** «Оригинал», «Черновик 1 из 3» — что сейчас на экране. */
  caption?: string;
  onPrev?: () => void;
  onNext?: () => void;
}

export function LightboxNav({ caption, onPrev, onNext }: LightboxNavigation) {
  return (
    <>
      {caption && (
        <div className={styles.caption} onClick={(e) => e.stopPropagation()}>
          {caption}
        </div>
      )}
      {onPrev && (
        <ActionIcon
          size={44}
          radius="xl"
          variant="filled"
          className={`${styles.button} ${styles.nav} ${styles.navPrev}`}
          aria-label="Предыдущая картинка"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
        >
          <ChevronLeft size={24} />
        </ActionIcon>
      )}
      {onNext && (
        <ActionIcon
          size={44}
          radius="xl"
          variant="filled"
          className={`${styles.button} ${styles.nav} ${styles.navNext}`}
          aria-label="Следующая картинка"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          <ChevronRight size={24} />
        </ActionIcon>
      )}
    </>
  );
}
