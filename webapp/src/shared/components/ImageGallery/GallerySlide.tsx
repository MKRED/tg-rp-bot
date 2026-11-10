import { Loader } from "@mantine/core";
import { useEffect, useRef } from "react";
import { type ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import styles from "./ImageGallery.module.css";

interface GallerySlideProps {
  src?: string;
  /** Слайд на экране: зумится только он, соседние — просто картинки в ленте. */
  active: boolean;
  /** Сдвиг от текущего слайда: −1 — слева, 0 — на экране, 1 — справа. */
  offset: number;
  /** Текущий слайд приближен — тогда палец двигает картинку, а не ленту. */
  zoomed: boolean;
  onZoomChange: (zoomed: boolean) => void;
}

/**
 * Слайд ленты. Обёртка зума есть у каждого слайда, но включена только у текущего — тогда при листании
 * React переносит тот же элемент (ключ — картинка), и уже загруженная соседняя не мигает.
 */
export function GallerySlide({ src, active, offset, zoomed, onZoomChange }: GallerySlideProps) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  // Ушли со слайда — сбрасываем зум, чтобы вернуться к нему целиком.
  useEffect(() => {
    if (!active) transformRef.current?.resetTransform(0);
  }, [active]);

  return (
    <div className={styles.slide} style={{ left: `${offset * 100}%` }}>
      {src ? (
        <TransformWrapper
          ref={transformRef}
          disabled={!active}
          minScale={1}
          maxScale={5}
          // Без зума палец листает ленту, а не двигает картинку: пан включается только в приближении.
          panning={{ disabled: !(active && zoomed) }}
          doubleClick={{ mode: "toggle", step: 0.9 }}
          onTransform={(_ref, state) => {
            if (active) onZoomChange(state.scale > 1.01);
          }}
        >
          <TransformComponent wrapperClass={styles.zoomArea} contentClass={styles.zoomArea}>
            <img className={styles.image} src={src} alt="" draggable={false} />
          </TransformComponent>
        </TransformWrapper>
      ) : (
        <Loader color="white" />
      )}
    </div>
  );
}
