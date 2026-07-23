import { Avatar, Button, FileInput } from "@telegram-apps/telegram-ui";
import { AnimatePresence } from "framer-motion";
import { type ChangeEvent, useEffect, useState } from "react";
import { buildAvatarImages, type CropArea } from "../../image";
import { nameInitials } from "../../text/initials";
import { ImageCropEditor } from "../ImageCropEditor";
import { ImageLightbox } from "../ImageLightbox";
import "./AvatarPicker.css";

/** Пара картинок аватара: миниатюра (кроп) + полное фото (без кадрирования). */
export interface AvatarValue {
  image: string;
  imageFull: string;
}

interface AvatarPickerProps {
  /** Текущая миниатюра (data URL) или null. */
  image: string | null;
  /** Полное фото (data URL) или null — для просмотра без кадрирования. */
  imageFull: string | null;
  /** Имя — для инициалов-заглушки, пока аватар не выбран. */
  name: string;
  /** Передаёт обе картинки при выборе нового фото, либо null при удалении. */
  onChange: (value: AvatarValue | null) => void;
}

/**
 * Выбор аватара: превью + загрузка файла с кропом миниатюры + удаление. При выборе файла
 * открывается редактор кропа (пан/зум), из которого получаем квадратную миниатюру и полное фото.
 * Лайтбокс показывает фото целиком (imageFull), а не кадрированный квадрат.
 */
export function AvatarPicker({ image, imageFull, name, onChange }: AvatarPickerProps) {
  const [busy, setBusy] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // object URL выбранного файла, пока открыт редактор кропа (null — редактор закрыт).
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // сброс — иначе повторный выбор того же файла не вызовет onChange
    if (!file || !file.type.startsWith("image/")) return;
    setCropSrc(URL.createObjectURL(file));
  };

  // Освобождаем object URL при смене/закрытии источника и при размонтировании (напр. навигация
  // «Назад» с открытым кроппером) — иначе URL утёк бы. Единая точка revoke вместо ручной.
  useEffect(() => {
    if (!cropSrc) return;
    return () => URL.revokeObjectURL(cropSrc);
  }, [cropSrc]);

  const closeCropper = () => setCropSrc(null);

  const handleCropConfirm = async (area: CropArea) => {
    if (!cropSrc) return;
    setBusy(true);
    try {
      const { thumb, full } = await buildAvatarImages(cropSrc, area);
      onChange({ image: thumb, imageFull: full });
    } catch {
      // тихо: некорректный/нечитаемый файл — просто не меняем аватар
    } finally {
      setBusy(false);
      closeCropper();
    }
  };

  // Лайтбокс показывает полное фото; для старых аватаров без imageFull — миниатюру.
  const lightboxSrc = imageFull ?? image;

  return (
    <div className="avatar-picker">
      {image ? (
        <button
          type="button"
          className="avatar-picker__zoom"
          onClick={() => setLightboxOpen(true)}
        >
          <Avatar size={96} src={image} acronym={nameInitials(name)} />
        </button>
      ) : (
        <Avatar size={96} acronym={nameInitials(name)} />
      )}
      <div className="avatar-picker__actions">
        <FileInput
          accept="image/*"
          disabled={busy}
          onChange={handleFile}
          label={image ? "Заменить фото" : "Загрузить фото"}
        />
        {image && (
          <Button size="s" mode="outline" disabled={busy} onClick={() => onChange(null)}>
            Удалить фото
          </Button>
        )}
      </div>
      <AnimatePresence>
        {cropSrc && (
          <ImageCropEditor
            src={cropSrc}
            busy={busy}
            onConfirm={handleCropConfirm}
            onCancel={closeCropper}
          />
        )}
        {lightboxOpen && lightboxSrc && (
          <ImageLightbox src={lightboxSrc} onClose={() => setLightboxOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
