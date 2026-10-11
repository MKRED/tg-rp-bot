import { Avatar, UnstyledButton } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { characterEditPath } from "../../../../app/routes";
import { sendPhotoToChat } from "../../../../shared/api/sendPhoto";
import { isInsideTelegram } from "../../../../shared/telegram/initData";
import { ImageLightbox } from "../../../../shared/components/ImageLightbox";
import { nameInitials as characterInitials } from "../../../../shared/text/initials";
import { useCharacterImage } from "../../hooks/useCharacterImage";
import { useCharacterImageFull } from "../../hooks/useCharacterImageFull";
import styles from "./CharacterAvatar.module.css";

interface CharacterAvatarProps {
  id: number;
  hasImage: boolean;
  name: string;
  size?: 20 | 24 | 28 | 40 | 48 | 96;
  /** Разрешает открывать лайтбокс по нажатию (только если картинка уже загружена). */
  enlargeable?: boolean;
}

/**
 * Аватар персонажа для списка: догружает картинку построчно (useCharacterImage), а пока её нет
 * (грузится или не задана) — показывает инициалы имени.
 */
export function CharacterAvatar({
  id,
  hasImage,
  name,
  size = 40,
  enlargeable = false,
}: CharacterAvatarProps) {
  const src = useCharacterImage(id, hasImage);
  const [open, setOpen] = useState(false);
  // Полное фото догружаем только когда лайтбокс открыт.
  const { src: fullSrc, loading: fullLoading } = useCharacterImageFull(id, open);

  // Что показываем в лайтбоксе: оригинал, как только он загружен. Пока грузится — undefined
  // (лайтбокс покажет спиннер), чтобы не мелькать миниатюрой. Когда полного фото нет вовсе
  // (загрузка завершена, оригинала не оказалось) — откатываемся на миниатюру.
  const lightboxSrc = fullSrc ?? (fullLoading ? undefined : src);

  // Лайтбокс доступен только когда картинка уже загружена
  const canEnlarge = enlargeable && Boolean(src);

  // Инициалы — заглушка, пока картинки нет; цвет — акцент палитры.
  const avatar = (
    <Avatar size={size} src={src} color="accent">
      {characterInitials(name)}
    </Avatar>
  );

  return (
    <>
      {canEnlarge ? (
        <UnstyledButton
          className={styles.zoom}
          aria-label={`Открыть фото: ${name}`}
          onClick={(e) => {
            e.stopPropagation(); // не передаём клик на Cell → не переходим на редактирование
            setOpen(true);
          }}
        >
          {avatar}
        </UnstyledButton>
      ) : (
        avatar
      )}
      <AnimatePresence>
        {open && src && (
          <ImageLightbox
            src={lightboxSrc}
            // «Отправить в чат» — через бота в личку по Telegram id; в браузере (вход по логину) его нет.
            onSend={
              isInsideTelegram()
                ? (photo) => sendPhotoToChat(photo, { label: name, deepLink: characterEditPath(id) })
                : undefined
            }
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
