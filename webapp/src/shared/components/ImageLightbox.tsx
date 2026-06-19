import { Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
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
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
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

  // Контент библиотеки — fit-content по картинке, поэтому центрируем императивно после того,
  // как у <img> появятся размеры (centerOnInit не сработает на ещё не загруженном фото).
  const handleLoaded = () => {
    setLoaded(true);
    transformRef.current?.centerView(1, 0);
  };

  // Смена источника — ждём декодирования заново. Если картинка уже в кэше браузера
  // (data URL), onLoad мог сработать до навешивания обработчика — проверяем .complete вручную
  // и центрируем на следующем кадре, когда fit-content успеет измериться по картинке.
  useEffect(() => {
    setLoaded(false);
    const img = imgRef.current;
    if (src && img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
      requestAnimationFrame(() => transformRef.current?.centerView(1, 0));
    }
  }, [src]);

  // Тап по фону (не по картинке) закрывает — но не когда включён зум.
  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).tagName === "IMG") return; // жест по картинке
    if (zoomedRef.current) return; // в зуме закрываем только кнопкой «×»
    onClose();
  };

  // Скачивание текущего фото. src — data URL (base64), поэтому прокачиваем через blob и
  // object URL: так браузер/вебвью сохраняет файл, а расширение берём из MIME blob'а.
  const handleDownload = async () => {
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "jpg";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Запасной путь: прямой data URL в href (если fetch недоступен в вебвью).
      const a = document.createElement("a");
      a.href = src;
      a.download = "image";
      a.click();
    }
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

      {/* Кнопка появляется только когда фото загружено (есть что скачивать). */}
      {src && loaded && (
        <button
          type="button"
          className="image-lightbox__download"
          aria-label="Скачать"
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {src && (
        <TransformWrapper
          ref={transformRef}
          minScale={1}
          maxScale={5}
          centerOnInit
          // Двойной тап переключает 1×↔~2.5× (e^step), а не слэмит в максимум.
          doubleClick={{ mode: "toggle", step: 0.9 }}
          // wheel.step не задаём — дефолт 0.015 даёт плавный зум (наше прежнее 0.2,
          // умноженное на |deltaY|, прыгало сразу в максимум).
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
              onLoad={handleLoaded}
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
