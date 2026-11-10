import { Loader, UnstyledButton } from "@mantine/core";
import { useEffect, useRef } from "react";
import type { GalleryItem } from "./types";
import styles from "./ImageGallery.module.css";

interface GalleryStripProps {
  items: GalleryItem[];
  index: number;
  onSelect: (index: number) => void;
}

/** Полоса миниатюр внизу: текущая выделена и держится в зоне видимости, тап — переход к картинке. */
export function GalleryStrip({ items, index, onSelect }: GalleryStripProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  return (
    <div className={styles.strip} onClick={(e) => e.stopPropagation()}>
      {items.map((item, i) => {
        const preview = item.thumb ?? item.src;
        return (
          <UnstyledButton
            key={item.key}
            ref={i === index ? activeRef : undefined}
            className={styles.thumb}
            data-active={i === index}
            onClick={() => onSelect(i)}
            aria-label={item.caption ?? `Картинка ${i + 1}`}
            aria-current={i === index}
          >
            {preview ? <img src={preview} alt="" draggable={false} /> : <Loader size="xs" color="white" />}
          </UnstyledButton>
        );
      })}
    </div>
  );
}
