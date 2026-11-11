import { UnstyledButton } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { getCachedAvatar } from "../../../../shared/avatar/avatarCache";
import { ImageGallery } from "../../../../shared/components/ImageGallery";
import { castKey, useCastImages } from "../../hooks/useCastImages";
import type { StoryAvatarRef } from "../../types/story";
import { StoryAvatars } from "../StoryAvatars";
import styles from "./StoryCast.module.css";

interface StoryCastProps {
  /** Персонажи и персоны книги (до 5, порядок книги). */
  avatars: StoryAvatarRef[];
  size: number;
  max: number;
}

/**
 * Стопка аватаров в шапке истории: нажатие открывает галерею с картинками всех героев книги —
 * и тех, что спрятаны под «+N». Герои без картинки в галерею не попадают; картинок нет ни у кого —
 * стопка просто аватары, без нажатия.
 */
export function StoryCast({ avatars, size, max }: StoryCastProps) {
  const cast = avatars.filter((a) => a.hasImage);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const images = useCastImages(cast, open);

  const stack = <StoryAvatars avatars={avatars} size={size} max={max} />;
  if (cast.length === 0) return stack;

  return (
    <>
      <UnstyledButton
        className={styles.button}
        aria-label="Картинки героев"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
      >
        {stack}
      </UnstyledButton>
      <AnimatePresence>
        {open && (
          <ImageGallery
            items={cast.map((a) => {
              const thumb = getCachedAvatar(a);
              const full = images[castKey(a)];
              // null — полная не загрузилась: показываем аватар, а не вечный спиннер.
              return { key: castKey(a), caption: a.name, thumb, src: full === null ? thumb : full };
            })}
            index={index}
            onIndexChange={setIndex}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
