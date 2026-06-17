import { Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { pushBackInterceptor } from "../telegram/backInterceptor";
import "./ImageLightbox.css";

interface ImageLightboxProps {
  /**
   * Изображение для показа. Пока полное фото догружается из сети — undefined: показываем
   * индикатор, а не миниатюру, чтобы картинка не «скакала» при подмене на оригинал.
   */
  src?: string;
  onClose: () => void;
}

/**
 * Полноэкранный просмотр изображения с зумом (pinch / двойной тап / колесо) и панорамированием.
 * Рендерится через portal в document.body — избегает z-index конфликтов.
 * AnimatePresence в родителе (CharacterAvatar) координирует exit-анимацию перед unmount.
 *
 * Пока изображение не декодировано (src ещё грузится или картинка не успела отрисоваться) —
 * показываем спиннер и держим <img> скрытым; появление с анимацией только по готовности.
 *
 * Закрытие: кнопка «×», нативная «Назад», Esc, а также тап по тёмному фону — но только когда
 * зум не активен (иначе тап в процессе пана случайно закрывал бы просмотр; в зуме закрываем
 * кнопкой). Тап по самой картинке не закрывает — там работают жесты зума.
 */
export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // Текущий масштаб > 1 — для решения «закрывать ли по тапу на фон».
  const zoomedRef = useRef(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Нативная «Назад» закрывает просмотр, а не уводит со страницы.
  useEffect(() => pushBackInterceptor(onClose), [onClose]);

  // Смена источника — ждём декодирования заново. Если картинка уже в кэше браузера
  // (data URL), onLoad мог сработать до навешивания обработчика — проверяем .complete вручную.
  useEffect(() => {
    setLoaded(false);
    const img = imgRef.current;
    if (src && img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [src]);

  // Тап по фону (не по картинке) закрывает — но не когда включён зум.
  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).tagName === "IMG") return; // жест по картинке
    if (zoomedRef.current) return; // в зуме закрываем только кнопкой «×»
    onClose();
  };

  return createPortal(
    <motion.div
      className="image-lightbox"
      onClick={handleBackdropClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        className="image-lightbox__close"
        aria-label="Закрыть"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        ×
      </button>

      {src && (
        <TransformWrapper
          minScale={1}
          maxScale={5}
          doubleClick={{ mode: "toggle", step: 2 }}
          wheel={{ step: 0.2 }}
          onTransform={(_ref, state) => { zoomedRef.current = state.scale > 1.01; }}
        >
          <TransformComponent
            wrapperClass="image-lightbox__viewport"
            contentClass="image-lightbox__content"
          >
            <img
              ref={imgRef}
              className="image-lightbox__img"
              src={src}
              alt=""
              draggable={false}
              onLoad={() => setLoaded(true)}
              style={{ opacity: loaded ? 1 : 0 }}
            />
          </TransformComponent>
        </TransformWrapper>
      )}

      {!loaded && (
        <div className="image-lightbox__spinner">
          <Spinner size="l" />
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
