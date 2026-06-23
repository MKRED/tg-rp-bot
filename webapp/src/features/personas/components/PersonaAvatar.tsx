import { Avatar } from "@telegram-apps/telegram-ui";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { personaEditPath } from "../../../app/routes";
import { sendPhotoToChat } from "../../../shared/api/sendPhoto";
import { ImageLightbox } from "../../../shared/components/ImageLightbox";
import { nameInitials } from "../../../shared/text/initials";
import { usePersonaImage } from "../hooks/usePersonaImage";
import { usePersonaImageFull } from "../hooks/usePersonaImageFull";
import "./PersonaAvatar.css";

interface PersonaAvatarProps {
  id: number;
  hasImage: boolean;
  name: string;
  size?: 20 | 24 | 28 | 40 | 48 | 96;
  /** Разрешает открывать лайтбокс по нажатию (только если картинка уже загружена). */
  enlargeable?: boolean;
}

/**
 * Аватар персоны для списка: догружает картинку построчно (usePersonaImage), а пока её нет
 * (грузится или не задана) — показывает инициалы имени.
 */
export function PersonaAvatar({ id, hasImage, name, size = 40, enlargeable = false }: PersonaAvatarProps) {
  const src = usePersonaImage(id, hasImage);
  const [open, setOpen] = useState(false);
  // Полное фото догружаем только когда лайтбокс открыт.
  const { src: fullSrc, loading: fullLoading } = usePersonaImageFull(id, open);

  // Что показываем в лайтбоксе: оригинал, как только он загружен. Пока грузится — undefined
  // (лайтбокс покажет спиннер), чтобы не мелькать миниатюрой. Когда полного фото нет вовсе
  // (загрузка завершена, оригинала не оказалось) — откатываемся на миниатюру.
  const lightboxSrc = fullSrc ?? (fullLoading ? undefined : src);

  // Лайтбокс доступен только когда картинка уже загружена
  const canEnlarge = enlargeable && Boolean(src);

  const avatar = <Avatar size={size} src={src} acronym={nameInitials(name)} />;

  return (
    <>
      {canEnlarge ? (
        <button
          type="button"
          className="persona-avatar__btn"
          onClick={(e) => {
            e.stopPropagation(); // не передаём клик на Cell → не переходим на редактирование
            setOpen(true);
          }}
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
      <AnimatePresence>
        {open && src && (
          <ImageLightbox
            src={lightboxSrc}
            onSend={(photo) =>
              sendPhotoToChat(photo, { label: name, deepLink: personaEditPath(id) })
            }
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
