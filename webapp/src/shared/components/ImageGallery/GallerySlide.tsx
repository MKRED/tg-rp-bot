import { Loader } from "@mantine/core";
import { motion } from "framer-motion";
import { memo, useEffect, useRef } from "react";
import { type ZoomHandle, useZoomPan } from "./zoomPan";
import styles from "./ImageGallery.module.css";

const MAX_SCALE = 5;

interface GallerySlideProps {
  src?: string;
  /** Слайд на экране: зумится только он, соседние — просто картинки в ленте. */
  active: boolean;
  /** Сдвиг от текущего слайда: −1 — слева, 0 — на экране, 1 — справа. */
  offset: number;
  onZoomChange: (zoomed: boolean) => void;
  /** Сюда текущий слайд кладёт управление своим зумом — им пользуются жесты и двойной тап галереи. */
  zoomRef: React.RefObject<ZoomHandle | null>;
}

/**
 * Слайд ленты. Картинку вписывает CSS (во весь экран по центру, панели лежат поверх), зум и
 * сдвиг — transform поверх раскладки (useZoomPan). Слайды — с ключом по картинке:
 * при листании React переносит тот же элемент, и соседняя не мигает.
 */
export const GallerySlide = memo(function GallerySlide({ src, active, offset, onZoomChange, zoomRef }: GallerySlideProps) {
  const activeRef = useRef(active);
  activeRef.current = active;
  const zoom = useZoomPan({
    maxScale: MAX_SCALE,
    onZoomChange: (zoomed) => {
      if (activeRef.current) onZoomChange(zoomed);
    },
  });
  const { handle } = zoom;

  // Текущий слайд отдаёт галерее управление зумом; ушли с него — к 1×, чтобы вернуться к нему целиком.
  useEffect(() => {
    if (!active) {
      handle.reset();
      return;
    }
    zoomRef.current = handle;
    return () => {
      if (zoomRef.current === handle) zoomRef.current = null;
    };
  }, [active, handle, zoomRef]);

  // Поворот экрана меняет раскладку под картинкой — приближение по старым размерам уже не к месту.
  useEffect(() => {
    const onResize = () => handle.reset();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [handle]);

  return (
    <div className={styles.slide} style={{ left: `${offset * 100}%` }}>
      {src ? (
        <motion.img ref={zoom.imgRef} className={styles.image} src={src} alt="" draggable={false} style={zoom.style} />
      ) : (
        <Loader color="white" />
      )}
    </div>
  );
});
