import { ActionIcon, Text } from "@mantine/core";
import { type AnimationPlaybackControls, animate, motion, useIsPresent, useMotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useOverlayBack } from "../../hooks/useOverlayBack";
import { suspendVerticalSwipes } from "../../telegram/verticalSwipes";
import { MOTION_TRANSITION } from "../../theme/motion";
import { GallerySlide, type ZoomToggle } from "./GallerySlide";
import { GalleryStrip } from "./GalleryStrip";
import type { GalleryItem } from "./types";
import { useTaps } from "./useTaps";
import { useSwipeTrack } from "./useSwipeTrack";
import styles from "./ImageGallery.module.css";

/**
 * Доводка ленты после отпускания: пружина стартует со скоростью пальца и тормозит без перелёта
 * (затухание чуть выше критического 2·√stiffness). Фиксированная длительность давала рывок на стыке:
 * медленно отпущенная лента вдруг срывалась, а брошенная — притормаживала.
 */
const SETTLE_SPRING = { type: "spring", stiffness: 170, damping: 27, restDelta: 0.5, restSpeed: 20 } as const;

interface ImageGalleryProps {
  items: GalleryItem[];
  /** Какая картинка на экране; галерея сообщает о листании через onIndexChange. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Полноэкранная галерея как в галерее телефона: чёрный фон, сверху «2 из 5» и подпись, картинка едет за
 * пальцем и соседняя въезжает следом, снизу полоса миниатюр. Зум — пинч, двойной тап, колесо; в зуме палец
 * двигает картинку, а не ленту. Одиночный тап прячет и возвращает панели. На компьютере — стрелки по краям и клавиши ←/→. Закрытие — «×», Esc,
 * «Назад» (Telegram, системная на телефоне, браузер). Рендерится в body через portal; AnimatePresence в родителе даёт плавное закрытие.
 */
export function ImageGallery({ items, index, onIndexChange, onClose }: ImageGalleryProps) {
  // Свой индекс: смену слайда после анимации ленты нужно применить в тот же кадр, что и сброс сдвига.
  const [shown, setShown] = useState(index);
  useEffect(() => setShown(index), [index]);
  const current = Math.min(Math.max(shown, 0), items.length - 1);
  const [zoomed, setZoomed] = useState(false);
  const x = useMotionValue(0);
  const stageRef = useRef<HTMLDivElement>(null);
  // Идущая доводка ленты и куда она ведёт (−1/+1 — к соседней, 0 — на место).
  const settling = useRef<{ controls: AnimationPlaybackControls; step: -1 | 0 | 1 } | null>(null);

  const hasPrev = current > 0;
  const hasNext = current < items.length - 1;

  const select = (next: number) => {
    flushSync(() => setShown(next));
    x.set(0);
    setZoomed(false);
    onIndexChange(next);
  };

  const stageWidth = () => stageRef.current?.offsetWidth ?? window.innerWidth;

  // −1/+1 — доводим ленту до соседней картинки и переключаемся на неё; 0 — возвращаем на место.
  const settle = (step: -1 | 0 | 1, velocity = 0) => {
    settling.current?.controls.stop();
    const target = current + step;
    const controls = animate(x, -step * stageWidth(), { ...SETTLE_SPRING, velocity });
    settling.current = { controls, step };
    void controls.then(() => {
      // Доводку перехватили пальцем или сменили картинку — переключаться уже не нам.
      if (settling.current?.controls !== controls) return;
      settling.current = null;
      if (step !== 0) select(target);
    });
  };

  // Палец лёг на доезжающую ленту: останавливаем её; если она ехала к соседней — переключаемся на ту
  // сразу и пересчитываем сдвиг от неё, чтобы картинка под пальцем не прыгнула.
  const grab = () => {
    const pending = settling.current;
    if (!pending) return;
    pending.controls.stop();
    settling.current = null;
    if (pending.step === 0) return;
    const offset = x.get();
    select(current + pending.step);
    x.set(offset + pending.step * stageWidth());
  };

  const go = (step: -1 | 1) => {
    if (settling.current || zoomed || (step < 0 ? !hasPrev : !hasNext)) return;
    settle(step);
  };

  const { onPointerDown } = useSwipeTrack({
    x,
    enabled: items.length > 1 && !zoomed,
    hasPrev,
    hasNext,
    width: stageWidth,
    onGrab: grab,
    onRelease: settle,
  });

  // Одиночный тап прячет шапку, миниатюры и стрелки — посмотреть на картинку без них; двойной — зум
  // текущего слайда к точке тапа.
  const [chrome, setChrome] = useState(true);
  const zoomToggle = useRef<ZoomToggle | null>(null);
  const tap = useTaps({
    onTap: () => setChrome((v) => !v),
    onDoubleTap: (cx, cy) => zoomToggle.current?.(cx, cy),
  });

  // Обработчик клавиш живёт всю галерею, а текущая картинка меняется — берём свежий go.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowLeft") goRef.current(-1);
      if (e.key === "ArrowRight") goRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // «Назад» (Telegram, системная на телефоне, браузер) закрывает галерею, а свайп вниз не сворачивает
  // Mini App посреди листания.
  useOverlayBack(onClose);
  useEffect(() => suspendVerticalSwipes(), []);

  // Закрытая галерея ещё ~200 мс гаснет поверх страницы — касания в это время идут странице, а не ей
  // (иначе тап по кнопке холста сразу после закрытия попадал в гаснущий «×» и терялся).
  const isPresent = useIsPresent();

  const item = items[current];

  return createPortal(
    <motion.div
      className={styles.root}
      data-strip={items.length > 1}
      data-chrome={chrome}
      style={{ pointerEvents: isPresent ? undefined : "none" }}
      // Любое касание (в т.ч. «×» и миниатюр) снимает ждущий одиночный тап: иначе он прятал шапку прямо
      // под пальцем, и нажатие «×» терялось.
      onPointerDownCapture={tap.cancelPending}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={MOTION_TRANSITION}
    >
      <div className={styles.header}>
        <span />
        <div className={styles.title}>
          <Text fw={600} c="white">
            {current + 1} из {items.length}
          </Text>
          {item?.caption && (
            <Text size="xs" c="gray.5" truncate>
              {item.caption}
            </Text>
          )}
        </div>
        <ActionIcon size={44} radius="xl" variant="subtle" color="gray.0" aria-label="Закрыть" onClick={onClose}>
          <X size={24} />
        </ActionIcon>
      </div>

      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={(e) => {
          tap.onPointerDown(e);
          onPointerDown(e);
        }}
        onPointerUp={tap.onPointerUp}
        onPointerCancel={tap.onPointerCancel}
      >
        <motion.div className={styles.track} style={{ x }}>
          {/* В ленте — текущая и соседние: их видно при протяжке. */}
          {[current - 1, current, current + 1].map((i) => {
            const slide = items[i];
            return (
              slide && (
                <GallerySlide
                  key={slide.key}
                  src={slide.src}
                  active={i === current}
                  offset={i - current}
                  onZoomChange={setZoomed}
                  zoomToggleRef={zoomToggle}
                />
              )
            );
          })}
        </motion.div>

        {hasPrev && !zoomed && (
          <ActionIcon className={`${styles.nav} ${styles.navPrev}`} size={44} radius="xl" variant="filled" aria-label="Предыдущая картинка" onPointerDown={(e) => e.stopPropagation()} onClick={() => go(-1)}>
            <ChevronLeft size={24} />
          </ActionIcon>
        )}
        {hasNext && !zoomed && (
          <ActionIcon className={`${styles.nav} ${styles.navNext}`} size={44} radius="xl" variant="filled" aria-label="Следующая картинка" onPointerDown={(e) => e.stopPropagation()} onClick={() => go(1)}>
            <ChevronRight size={24} />
          </ActionIcon>
        )}
      </div>

      {items.length > 1 && <GalleryStrip items={items} index={current} onSelect={(i) => {
            settling.current?.controls.stop();
            settling.current = null;
            select(i);
          }} />}
    </motion.div>,
    document.body,
  );
}
