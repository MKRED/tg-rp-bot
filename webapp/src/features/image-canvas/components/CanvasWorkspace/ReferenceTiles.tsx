import { FileButton, Loader, Menu, UnstyledButton } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImageLightbox } from "../../../../shared/components/ImageLightbox";
import { useToast } from "../../../../shared/toast";
import { getReferenceImage } from "../../api/image-canvas-api";
import type { CanvasState } from "../../hooks/useCanvas";
import { loadRemoteImage } from "../../hooks/useRemoteImage";
import { prepareReference } from "../../lib/canvasImages";
import { ClipboardImageError, canReadClipboardImage, imageFromDataTransfer, readClipboardImage } from "../../lib/clipboardImage";
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
 * Из буфера: Ctrl+V на экране (картинка — в следующий слот, текст вставляется как обычно) и пункт
 * «Вставить из буфера» у «+» — на телефоне событие вставки вне поля ввода не приходит.
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
  const full = nextSlot >= MAX_CANVAS_REFERENCES;

  const addFromClipboard = async () => {
    try {
      await attach(nextSlot, await readClipboardImage());
    } catch (err) {
      showToast({ type: "error", message: err instanceof ClipboardImageError ? err.message : "Не удалось вставить картинку" });
    }
  };

  // Ctrl+V: обработчик на window живёт всё время экрана, а слот и занятость меняются — берём свежие.
  const pasteRef = useRef<(file: File) => void>(() => undefined);
  pasteRef.current = (file) => {
    if (busy) return;
    if (full) {
      showToast({ type: "error", message: `Можно прикрепить не больше ${MAX_CANVAS_REFERENCES} картинок` });
      return;
    }
    void attach(nextSlot, file);
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromDataTransfer(e.clipboardData);
      if (!file) return; // текст — обычная вставка в поле
      e.preventDefault();
      pasteRef.current(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

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
      {!full &&
        (canReadClipboardImage() ? (
          <Menu position="top-start" withinPortal>
            <Menu.Target>
              <UnstyledButton className={`${styles.refTile} ${styles.refAdd}`} disabled={busy} aria-label="Прикрепить картинку">
                {preparing === nextSlot ? <Loader size="xs" /> : <ImagePlus size={20} />}
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <FileButton
                accept="image/*"
                onChange={(file) => void attach(nextSlot, file)}
                resetRef={(fn) => {
                  resetRefs.current[nextSlot] = fn;
                }}
              >
                {(props) => <Menu.Item {...props}>Выбрать файл</Menu.Item>}
              </FileButton>
              <Menu.Item onClick={() => void addFromClipboard()}>Вставить из буфера</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <FileButton
            accept="image/*"
            onChange={(file) => void attach(nextSlot, file)}
            resetRef={(fn) => {
              resetRefs.current[nextSlot] = fn;
            }}
          >
            {(props) => (
              <UnstyledButton {...props} className={`${styles.refTile} ${styles.refAdd}`} disabled={busy} aria-label="Прикрепить картинку">
                {preparing === nextSlot ? <Loader size="xs" /> : <ImagePlus size={20} />}
              </UnstyledButton>
            )}
          </FileButton>
        ))}
      <AnimatePresence>{viewing && <ImageLightbox src={viewing.src} onClose={() => setViewing(null)} />}</AnimatePresence>
    </div>
  );
}
