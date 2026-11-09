import { FileButton, Loader, Menu, UnstyledButton } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { ImageLightbox } from "../../../../shared/components/ImageLightbox";
import { useToast } from "../../../../shared/toast";
import { getReferenceImage } from "../../api/image-canvas-api";
import type { CanvasState } from "../../hooks/useCanvas";
import { loadRemoteImage } from "../../hooks/useRemoteImage";
import { prepareReference } from "../../lib/canvasImages";
import { MAX_CANVAS_REFERENCES, type ImageCanvas } from "../../types/imageCanvas";
import { referenceKey } from "./CanvasStage";
import styles from "./CanvasWorkspace.module.css";

interface ReferenceTilesProps {
  canvas: ImageCanvas;
  actions: CanvasState;
  disabled: boolean;
}

/**
 * Прикреплённые картинки: номер на плитке — тот же N, что в `<imageN>`. Тап по плитке — меню
 * «Посмотреть / Заменить / Убрать»; плитка «+» добавляет следующую, пока не набралось три.
 */
export function ReferenceTiles({ canvas, actions, disabled }: ReferenceTilesProps) {
  const { showToast } = useToast();
  const [preparing, setPreparing] = useState<number | null>(null);
  const [viewing, setViewing] = useState<{ src?: string } | null>(null);
  const resetRefs = useRef<Array<(() => void) | null>>([]);

  const attach = async (slot: number, file: File | null) => {
    resetRefs.current[slot]?.();
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast({ type: "error", message: "Это не картинка — выберите другой файл" });
      return;
    }
    setPreparing(slot);
    try {
      await actions.setReference(slot, await prepareReference(file));
    } catch (err) {
      console.error("Failed to prepare canvas reference", err);
      showToast({ type: "error", message: "Не удалось открыть картинку — попробуйте другой файл" });
    } finally {
      setPreparing(null);
    }
  };

  const view = (slot: number) => {
    const thumb = canvas.references[slot]!;
    setViewing({});
    loadRemoteImage(referenceKey(canvas.id, slot, thumb), () => getReferenceImage(canvas.id, slot).then((r) => r.image))
      .then((src) => setViewing({ src }))
      .catch((err) => {
        console.error("Failed to load canvas reference", err);
        setViewing(null);
        showToast({ type: "error", message: "Не удалось открыть картинку" });
      });
  };

  const busy = disabled || actions.busy === "reference" || preparing !== null;
  const nextSlot = canvas.references.length;

  return (
    <div className={styles.refs}>
      {canvas.references.map((thumb, slot) => (
        <Menu key={`${slot}:${thumb.length}`} position="top-start" withinPortal>
          <Menu.Target>
            <UnstyledButton className={styles.refTile} aria-label={`Картинка ${slot + 1}`} disabled={busy}>
              {preparing === slot ? <Loader size="xs" /> : <img src={thumb} alt="" />}
              <span className={styles.refTag}>{slot + 1}</span>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => view(slot)}>Посмотреть</Menu.Item>
            <FileButton
              accept="image/*"
              onChange={(file) => void attach(slot, file)}
              resetRef={(fn) => {
                resetRefs.current[slot] = fn;
              }}
            >
              {(props) => <Menu.Item {...props}>Заменить</Menu.Item>}
            </FileButton>
            <Menu.Item color="red" onClick={() => void actions.removeReference(slot)}>
              Убрать
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ))}
      {nextSlot < MAX_CANVAS_REFERENCES && (
        <FileButton accept="image/*" onChange={(file) => void attach(nextSlot, file)} resetRef={(fn) => {
            resetRefs.current[nextSlot] = fn;
          }}>
          {(props) => (
            <UnstyledButton {...props} className={`${styles.refTile} ${styles.refAdd}`} disabled={busy} aria-label="Прикрепить картинку">
              {preparing === nextSlot ? <Loader size="xs" /> : <ImagePlus size={20} />}
            </UnstyledButton>
          )}
        </FileButton>
      )}
      <AnimatePresence>{viewing && <ImageLightbox src={viewing.src} onClose={() => setViewing(null)} />}</AnimatePresence>
    </div>
  );
}
