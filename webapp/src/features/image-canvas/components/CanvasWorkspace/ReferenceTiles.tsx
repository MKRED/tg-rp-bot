import { Loader, Menu, UnstyledButton } from "@mantine/core";
import { AnimatePresence, Reorder } from "framer-motion";
import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImageLightbox } from "../../../../shared/components/ImageLightbox";
import { useToast } from "../../../../shared/toast";
import { getReferenceImage } from "../../api/image-canvas-api";
import type { CanvasState } from "../../hooks/useCanvas";
import { loadRemoteImage } from "../../hooks/useRemoteImage";
import { prepareReference } from "../../lib/canvasImages";
import { identityOrder, isReordered, swapOrder } from "../../lib/referenceOrder";
import { ClipboardImageError, canReadClipboardImage, imageFromDataTransfer, readClipboardImage } from "../../lib/clipboardImage";
import { MAX_CANVAS_REFERENCES, type ImageCanvas } from "../../types/imageCanvas";
import { referenceKey } from "./CanvasStage";
import { ReferenceTile } from "./ReferenceTile";
import styles from "./CanvasWorkspace.module.css";

interface ReferenceTilesProps {
  canvas: ImageCanvas;
  actions: CanvasState;
  disabled: boolean;
}

/**
 * Прикреплённые картинки: номер на плитке — тот же N, что в `<imageN>`. Тап по плитке — меню
 * «Посмотреть / Заменить / Левее / Правее / Убрать», протяжка — перестановка (номер едет за местом,
 * теги в промпте не меняются); плитка «+» добавляет следующую, пока не набралось три.
 * Из буфера: Ctrl+V на экране (картинка — в следующий слот, текст вставляется как обычно) и пункт
 * «Вставить из буфера» у «+» — на телефоне событие вставки вне поля ввода не приходит.
 * Поле выбора файла одно и лежит вне меню: внутри Menu.Dropdown оно размонтировалось бы вместе с
 * закрывшимся меню, и выбранный файл не доходил бы до onChange (на телефоне файл не добавлялся вовсе).
 */
export function ReferenceTiles({ canvas, actions, disabled }: ReferenceTilesProps) {
  const { showToast } = useToast();
  const [preparing, setPreparing] = useState<number | null>(null);
  const [viewing, setViewing] = useState<{ src?: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Слот, для которого открыт выбор файла: «+» — следующий, «Заменить» — свой.
  const pickSlot = useRef(0);

  const pickFile = (slot: number) => {
    pickSlot.current = slot;
    fileInput.current?.click();
  };

  const attach = async (slot: number, file: File | null | undefined) => {
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

  // Порядок на время протяжки: order[i] — слот картинки на месте i. Новый холст с сервера — исходный порядок.
  const count = canvas.references.length;
  const [order, setOrder] = useState(() => identityOrder(count));
  useEffect(() => setOrder(identityOrder(canvas.references.length)), [canvas.references]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const [menuSlot, setMenuSlot] = useState<number | null>(null);
  // Отпущенная после протяжки плитка получает click — он не должен открывать меню.
  const draggedAt = useRef(0);

  const commitDrag = () => {
    draggedAt.current = Date.now();
    const next = orderRef.current;
    if (isReordered(next)) void actions.reorderReferences(next);
  };

  const move = (position: number, dir: -1 | 1) => {
    const next = swapOrder(count, position, dir);
    if (next) void actions.reorderReferences(next);
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
      <Reorder.Group as="div" axis="x" values={order} onReorder={setOrder} className={styles.refs}>
        {order.map((from, position) => (
          <ReferenceTile
            key={from}
            value={from}
            position={position}
            count={count}
            thumb={canvas.references[from]!}
            preparing={preparing === position}
            busy={busy}
            menuOpened={menuSlot === position}
            onMenuChange={(opened) => {
              if (opened && Date.now() - draggedAt.current < 400) return;
              setMenuSlot(opened ? position : null);
            }}
            onDragStart={() => setMenuSlot(null)}
            onDragEnd={commitDrag}
            onView={() => view(position)}
            onReplace={() => pickFile(position)}
            onMove={(dir) => move(position, dir)}
            onRemove={() => void actions.removeReference(position)}
          />
        ))}
      </Reorder.Group>
      {!full &&
        (canReadClipboardImage() ? (
          <Menu position="top-start" withinPortal>
            <Menu.Target>
              <UnstyledButton className={`${styles.refTile} ${styles.refAdd}`} disabled={busy} aria-label="Прикрепить картинку">
                {preparing === nextSlot ? <Loader size="xs" /> : <ImagePlus size={20} />}
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => pickFile(nextSlot)}>Выбрать файл</Menu.Item>
              <Menu.Item onClick={() => void addFromClipboard()}>Вставить из буфера</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <UnstyledButton
            className={`${styles.refTile} ${styles.refAdd}`}
            disabled={busy}
            onClick={() => pickFile(nextSlot)}
            aria-label="Прикрепить картинку"
          >
            {preparing === nextSlot ? <Loader size="xs" /> : <ImagePlus size={20} />}
          </UnstyledButton>
        ))}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          // Сброс — чтобы тот же файл можно было выбрать повторно.
          e.currentTarget.value = "";
          void attach(pickSlot.current, file);
        }}
      />
      <AnimatePresence>{viewing && <ImageLightbox src={viewing.src} onClose={() => setViewing(null)} />}</AnimatePresence>
    </div>
  );
}
