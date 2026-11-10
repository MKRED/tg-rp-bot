import { Loader } from "@mantine/core";
import { memo, useEffect, useRef } from "react";
import { type ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import styles from "./ImageGallery.module.css";

/** Двойной тап переключает 1× ↔ ~2.5× (e^step), а не прыгает в максимум. */
const DOUBLE_TAP = { mode: "toggle", step: 0.9 } as const;

interface GallerySlideProps {
  src?: string;
  /** Слайд на экране: зумится только он, соседние — просто картинки в ленте. */
  active: boolean;
  /** Сдвиг от текущего слайда: −1 — слева, 0 — на экране, 1 — справа. */
  offset: number;
  onZoomChange: (zoomed: boolean) => void;
}

/**
 * Слайд ленты. Обёртка зума — на весь экран, а внутри — элемент ровно по размеру картинки: так
 * centerZoomedOut держит меньшую сторону по центру, а приближенную картинку не пускает дальше краёв
 * экрана (если бы элемент был во весь экран, его чёрные поля вокруг картинки утягивались бы в кадр).
 * Обёртка есть у каждого слайда, включена только у текущего — при листании React переносит тот же
 * элемент (ключ — картинка), и соседняя не мигает. Пропсы обёртки не меняются от зума: смена настроек
 * посреди анимации двойного тапа обрывала её.
 */
export const GallerySlide = memo(function GallerySlide({ src, active, offset, onZoomChange }: GallerySlideProps) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Ушли со слайда — возвращаем к 1× по центру, чтобы вернуться к нему целиком.
  useEffect(() => {
    if (!active) transformRef.current?.centerView(1, 0);
  }, [active]);

  return (
    <div className={styles.slide} style={{ left: `${offset * 100}%` }}>
      {src ? (
        <TransformWrapper
          ref={transformRef}
          disabled={!active}
          minScale={1}
          maxScale={5}
          centerOnInit
          centerZoomedOut
          doubleClick={DOUBLE_TAP}
          onTransform={(_ref, state) => {
            if (activeRef.current) onZoomChange(state.scale > 1.01);
          }}
        >
          <TransformComponent wrapperClass={styles.zoomArea}>
            <img
              className={styles.image}
              src={src}
              alt=""
              draggable={false}
              // Размер элемента появляется только после загрузки — центрируем по нему.
              onLoad={() => transformRef.current?.centerView(1, 0)}
            />
          </TransformComponent>
        </TransformWrapper>
      ) : (
        <Loader color="white" />
      )}
    </div>
  );
});
