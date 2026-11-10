import { Loader } from "@mantine/core";
import { memo, useEffect, useRef } from "react";
import { type ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { doubleTapTarget } from "./zoomTarget";
import styles from "./ImageGallery.module.css";

const MAX_SCALE = 5;
/** Двойной тап у библиотеки выключен — он свой (useTaps), см. там почему. */
const NO_DOUBLE_CLICK = { disabled: true } as const;
/** Двойной тап зумит к точке под пальцем (clientX/Y) или возвращает к 1×. */
export type ZoomToggle = (clientX: number, clientY: number) => void;

interface GallerySlideProps {
  src?: string;
  /** Слайд на экране: зумится только он, соседние — просто картинки в ленте. */
  active: boolean;
  /** Сдвиг от текущего слайда: −1 — слева, 0 — на экране, 1 — справа. */
  offset: number;
  onZoomChange: (zoomed: boolean) => void;
  /** Сюда текущий слайд кладёт переключатель зума для двойного тапа галереи. */
  zoomToggleRef: React.RefObject<ZoomToggle | null>;
}

/**
 * Слайд ленты. Обёртка зума — на весь экран, а внутри — элемент ровно по размеру картинки: так
 * centerZoomedOut держит меньшую сторону по центру, а приближенную картинку не пускает дальше краёв
 * экрана (если бы элемент был во весь экран, его чёрные поля вокруг картинки утягивались бы в кадр).
 * Обёртка есть у каждого слайда, включена только у текущего — при листании React переносит тот же
 * элемент (ключ — картинка), и соседняя не мигает. Пропсы обёртки не меняются от зума: смена настроек
 * посреди анимации двойного тапа обрывала её.
 */
export const GallerySlide = memo(function GallerySlide({ src, active, offset, onZoomChange, zoomToggleRef }: GallerySlideProps) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Ушли со слайда — возвращаем к 1× по центру, чтобы вернуться к нему целиком.
  useEffect(() => {
    if (!active) transformRef.current?.centerView(1, 0);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const toggle: ZoomToggle = (clientX, clientY) => {
      const zoom = transformRef.current;
      const wrapper = zoom?.instance.wrapperComponent;
      const content = zoom?.instance.contentComponent;
      if (!zoom || !wrapper || !content) return;
      const rect = wrapper.getBoundingClientRect();
      const { positionX, positionY, scale } = zoom.instance.state;
      const target = doubleTapTarget({
        px: clientX - rect.left,
        py: clientY - rect.top,
        x: positionX,
        y: positionY,
        scale,
        maxScale: MAX_SCALE,
        wrapperW: wrapper.offsetWidth,
        wrapperH: wrapper.offsetHeight,
        contentW: content.offsetWidth,
        contentH: content.offsetHeight,
      });
      zoom.setTransform(target.x, target.y, target.scale, 250, "easeOut");
    };
    zoomToggleRef.current = toggle;
    return () => {
      if (zoomToggleRef.current === toggle) zoomToggleRef.current = null;
    };
  }, [active, zoomToggleRef]);

  return (
    <div className={styles.slide} style={{ left: `${offset * 100}%` }}>
      {src ? (
        <TransformWrapper
          ref={transformRef}
          disabled={!active}
          minScale={1}
          maxScale={MAX_SCALE}
          centerOnInit
          centerZoomedOut
          doubleClick={NO_DOUBLE_CLICK}
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
