import { Avatar, Button, FileButton, Group, Stack, UnstyledButton } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { buildAvatarImages, type CropArea } from "../../image";
import { nameInitials } from "../../text/initials";
import { useToast } from "../../toast";
import { ImageCropEditor } from "../ImageCropEditor";
import { ImageLightbox } from "../ImageLightbox";
import styles from "./AvatarPicker.module.css";

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
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // object URL выбранного файла, пока открыт редактор кропа (null — редактор закрыт).
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const resetFileRef = useRef<() => void>(null);

  const handleFile = (file: File | null) => {
    resetFileRef.current?.(); // сброс — иначе повторный выбор того же файла не вызовет onChange
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
    } catch (err) {
      // Некорректный/нечитаемый файл — аватар не меняем, но говорим почему.
      console.warn("Не удалось подготовить аватар", err);
      showToast({ type: "error", message: "Не удалось открыть фото — попробуйте другой файл" });
    } finally {
      setBusy(false);
      closeCropper();
    }
  };

  // Лайтбокс показывает полное фото; для старых аватаров без imageFull — миниатюру.
  const lightboxSrc = imageFull ?? image;

  return (
    <Group gap="md" wrap="nowrap" className={styles.root}>
      {/* Инициалы — как у аватаров в списках (nameInitials); цвет — акцент палитры. */}
      {image ? (
        <UnstyledButton className={styles.zoom} onClick={() => setLightboxOpen(true)} aria-label="Открыть фото">
          <Avatar size={96} src={image} color="accent">
            {nameInitials(name)}
          </Avatar>
        </UnstyledButton>
      ) : (
        <Avatar size={96} color="accent">
          {nameInitials(name) || undefined}
        </Avatar>
      )}
      <Stack gap="xs" flex={1}>
        <FileButton accept="image/*" onChange={handleFile} disabled={busy} resetRef={resetFileRef}>
          {(props) => (
            <Button {...props} variant="light" disabled={busy}>
              {image ? "Заменить фото" : "Загрузить фото"}
            </Button>
          )}
        </FileButton>
        {image && (
          <Button variant="subtle" color="red" className={styles.danger} disabled={busy} onClick={() => onChange(null)}>
            Удалить фото
          </Button>
        )}
      </Stack>
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
    </Group>
  );
}
