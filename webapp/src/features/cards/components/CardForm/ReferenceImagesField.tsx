import { ActionIcon, FileButton, Input, Loader, UnstyledButton } from "@mantine/core";
import { REFERENCE_IMAGE_MAX_SIDE } from "@tg-rp-bot/shared";
import { AnimatePresence } from "framer-motion";
import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { ImageLightbox } from "../../../../shared/components/ImageLightbox";
import { buildScaledImage } from "../../../../shared/image";
import { useToast } from "../../../../shared/toast";
import { MAX_CARD_REFERENCE_IMAGES } from "../../types/card";
import styles from "./ReferenceImagesField.module.css";

interface ReferenceImagesFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
}

/** Готовит выбранные файлы: только картинки, не больше свободных мест, каждая ужата до JPEG. */
async function prepareImages(files: File[], freeSlots: number): Promise<string[]> {
  const picked = files.filter((f) => f.type.startsWith("image/")).slice(0, freeSlots);
  return Promise.all(
    picked.map(async (file) => {
      const src = URL.createObjectURL(file);
      try {
        return await buildScaledImage(src, REFERENCE_IMAGE_MAX_SIDE);
      } finally {
        URL.revokeObjectURL(src);
      }
    }),
  );
}

/**
 * Картинки-референсы внешности карточки: ряд миниатюр (тап — просмотр целиком, крестик — убрать) и
 * плитка «добавить», пока не набран лимит. Можно выбрать сразу несколько файлов — лишние сверх лимита
 * отбрасываются с подсказкой. Кропа нет: модель должна видеть картинку целиком.
 */
export function ReferenceImagesField({ images, onChange }: ReferenceImagesFieldProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const resetFileRef = useRef<() => void>(null);
  const freeSlots = MAX_CARD_REFERENCE_IMAGES - images.length;

  const handleFiles = async (files: File[]) => {
    resetFileRef.current?.(); // иначе повторный выбор того же файла не вызовет onChange
    if (files.length === 0 || freeSlots <= 0) return;
    setBusy(true);
    try {
      const prepared = await prepareImages(files, freeSlots);
      if (prepared.length > 0) onChange([...images, ...prepared]);
      if (files.length > freeSlots) {
        showToast({ type: "error", message: `Можно не больше ${MAX_CARD_REFERENCE_IMAGES} референсов` });
      }
    } catch (err) {
      console.warn("Не удалось подготовить референс", err);
      showToast({ type: "error", message: "Не удалось открыть картинку — попробуйте другой файл" });
    } finally {
      setBusy(false);
    }
  };

  return (
    // size="md" — подпись того же размера, что у соседних полей формы (PickerField, PromptEditorField).
    <Input.Wrapper
      size="md"
      label="Референсы внешности"
      description={`До ${MAX_CARD_REFERENCE_IMAGES} картинок — ИИ посмотрит на них при генерации каждого блока`}
    >
      <div className={styles.grid}>
        {images.map((image, index) => (
          <div key={index} className={styles.tile}>
            <UnstyledButton className={styles.preview} onClick={() => setViewing(image)} aria-label="Открыть референс">
              <img src={image} alt={`Референс ${index + 1}`} className={styles.image} />
            </UnstyledButton>
            <ActionIcon
              className={styles.remove}
              variant="filled"
              color="dark"
              radius="xl"
              size={28}
              aria-label="Убрать референс"
              disabled={busy}
              onClick={() => onChange(images.filter((_, i) => i !== index))}
            >
              <X size={16} />
            </ActionIcon>
          </div>
        ))}
        {freeSlots > 0 && (
          <FileButton accept="image/*" multiple onChange={(files) => void handleFiles(files)} resetRef={resetFileRef}>
            {(props) => (
              <UnstyledButton {...props} className={styles.add} disabled={busy} aria-label="Добавить референс">
                {busy ? <Loader size="sm" /> : <ImagePlus size={24} />}
              </UnstyledButton>
            )}
          </FileButton>
        )}
      </div>
      <AnimatePresence>
        {viewing && <ImageLightbox src={viewing} onClose={() => setViewing(null)} />}
      </AnimatePresence>
    </Input.Wrapper>
  );
}
