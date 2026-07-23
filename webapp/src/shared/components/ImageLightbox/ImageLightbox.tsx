import { Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import { pushBackInterceptor } from "../../telegram/backInterceptor";
import { useToast } from "../../toast";
import "./ImageLightbox.css";

interface ImageLightboxProps {
  /**
   * Изображение для показа. Пока полное фото догружается из сети — undefined: показываем
   * индикатор, а не миниатюру, чтобы картинка не «скакала» при подмене на оригинал.
   */
  src?: string;
  /**
   * Действие «отправить картинку» (получает текущий показанный src). Если задано — вместо
   * скачивания показываем кнопку отправки. Замена «скачать»: в Telegram webview на мобильных
   * скачивание файла не работает, а отправка в чат с ботом — нативно. Без onSend кнопки нет.
   */
  onSend?: (src: string) => Promise<void>;
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
export function ImageLightbox({ src, onSend, onClose }: ImageLightboxProps) {
  const [loaded, setLoaded] = useState(false);
  // Идёт отправка фото в чат — блокируем кнопку, чтобы не отправить дубль по повторному тапу.
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();
  const imgRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  // Текущий масштаб > 1. Нужен и для решения «закрывать ли по тапу на фон», и чтобы
  // включать ограничение границами/инерцию только в приближённом состоянии. State, а не
  // ref: от него зависят пропы limitToBounds / velocityAnimation.
  const [zoomed, setZoomed] = useState(false);

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
    if (zoomed) return; // в зуме закрываем только кнопкой «×»
    onClose();
  };

  // Отправка текущего фото в чат с ботом. Блокируем кнопку на время запроса (анти-дабл-тап) и
  // в любом исходе показываем тост — пользователь видит результат, а не «молчаливый» провал.
  const handleSend = async () => {
    if (!src || !onSend || sending) return;
    setSending(true);
    try {
      await onSend(src);
      showToast({ type: "success", message: "Фото отправлено в чат с ботом" });
    } catch {
      showToast({ type: "error", message: "Не удалось отправить фото" });
    } finally {
      setSending(false);
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

      {/* Кнопка «отправить в чат» — только если задан onSend и фото загружено. На время
          отправки показываем спиннер и блокируем кнопку (анти-дабл-тап). */}
      {onSend && src && loaded && (
        <button
          type="button"
          className="image-lightbox__send"
          aria-label="Отправить в чат"
          disabled={sending}
          onClick={(e) => { e.stopPropagation(); handleSend(); }}
        >
          {sending ? (
            <Spinner size="s" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {/* Бумажный самолётик — отправка. */}
              <path
                d="M21 3L3 10.5l6 2.5m12-10l-7 18-2.5-7m9.5-11l-9.5 11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}

      {src && (
        <TransformWrapper
          ref={transformRef}
          minScale={1}
          maxScale={5}
          centerOnInit
          // Возвращаем картинку в центр при зуме обратно к 1× (без этого она «застывала»
          // там, где её отпустили в приближённом состоянии).
          centerZoomedOut
          // В неприближённом состоянии (scale ≤ 1) границы выключены — картинку можно свободно
          // потянуть в любую сторону. При зуме (scale > 1) включаем bounds, чтобы приближённое
          // фото нельзя было утащить в пустоту и там бросить.
          limitToBounds={zoomed}
          // Инерцию глушим на scale 1 — иначе бросок после отпускания «улетал» бы и боролся с
          // возвратом в центр; при зуме инерция остаётся.
          velocityAnimation={{ disabled: !zoomed }}
          // Двойной тап переключает 1×↔~2.5× (e^step), а не слэмит в максимум.
          doubleClick={{ mode: "toggle", step: 0.9 }}
          // wheel.step не задаём — дефолт 0.015 даёт плавный зум (наше прежнее 0.2,
          // умноженное на |deltaY|, прыгало сразу в максимум).
          onTransform={(_ref, state) => {
            const z = state.scale > 1.01;
            setZoomed((prev) => (prev !== z ? z : prev));
          }}
          // Отпустили после перетаскивания в неприближённом состоянии — плавно возвращаем фото
          // в центр (иначе оно осталось бы там, где брошено). Живой scale читаем из ref,
          // не из стейта zoomed (тот мог не успеть обновиться к моменту отпускания).
          onPanningStop={(ref) => {
            if (ref.state.scale <= 1.01) ref.centerView(1, 200);
          }}
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
